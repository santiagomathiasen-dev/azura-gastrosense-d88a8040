import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { content, fileType, extractRecipe } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Conteúdo ausente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // System instruction for better compliance
    const systemPrompt = `Você é um assistente especializado em gestão de estoque e culinária profissional.
Sua tarefa é extrair itens, produtos ou ingredientes de documentos (PDFs, fotos, textos).

REGRAS CRÍTICAS:
1. Analise INTEGRALMENTE o documento, percorrendo todas as páginas e colunas.
2. Identifique nomes de produtos, quantidades, unidades de medida e preços.
3. Se for uma Nota Fiscal (NF), extraia os itens listados.
4. Categorias válidas: laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros.
5. Unidades permitidas: kg, g, L, ml, unidade, caixa, dz.
6. Retorne SEMPRE um JSON válido.
7. No campo "summary", descreva brevemente o que encontrou ou por que não conseguiu extrair (se for o caso).`;

    let userPrompt = "";
    if (extractRecipe) {
      userPrompt = `Extraia os dados da receita e produtos para este JSON:
{
  "recipeName": "nome",
  "preparationMethod": "passo a passo",
  "preparationTime": minutos,
  "yieldQuantity": porções,
  "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string, "price": number, "supplier": string, "minimum_quantity": number}],
  "summary": "resumo do que foi lido"
}`;
    } else {
      userPrompt = `Extraia todos os itens encontrados no documento para este JSON:
{
  "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string, "price": number, "supplier": string, "minimum_quantity": number}],
  "summary": "resumo do que foi lido"
}`;
    }

    // Map file types to mime types
    const mimeType = fileType === "pdf" ? "application/pdf" : (fileType === "image" ? "image/jpeg" : "text/plain");

    const geminiBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          parts: [
            mimeType === "text/plain"
              ? { text: `Documento para analisar:\n${content}\n\n${userPrompt}` }
              : {
                inlineData: {
                  mimeType,
                  data: content,
                },
              },
            mimeType !== "text/plain" ? { text: userPrompt } : null,
          ].filter(Boolean),
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini request failed:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro na api do gemini", details: errorText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!assistantMessage) {
      const finishReason = aiResponse.candidates?.[0]?.finishReason || "UNKNOWN";
      console.warn("Gemini returned empty message. Finish reason:", finishReason);
      return new Response(
        JSON.stringify({
          ingredients: [],
          summary: `A IA não conseguiu processar o documento. Motivo: ${finishReason}. Tente novamente.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Raw response preview:", assistantMessage.slice(0, 150));

    let result: any = { ingredients: [], summary: "" };

    try {
      let cleaned = assistantMessage.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
      }
      const parsed = JSON.parse(cleaned);
      result = {
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : (Array.isArray(parsed) ? parsed : []),
        summary: parsed.summary || "",
        recipeName: parsed.recipeName,
        preparationMethod: parsed.preparationMethod,
        preparationTime: parsed.preparationTime,
        yieldQuantity: parsed.yieldQuantity,
      };
    } catch (e) {
      console.error("Parse failure:", e);
      // Regex fallback
      const match = assistantMessage.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          result = {
            ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : (Array.isArray(parsed) ? parsed : []),
            summary: parsed.summary || "Recuperado via regex",
          };
        } catch (e2) {
          result.summary = "Erro ao processar formato da resposta.";
        }
      }
    }

    // Normalization
    const validUnits = ["kg", "g", "L", "ml", "unidade", "caixa", "dz"];
    const validCategories = ["laticinios", "secos_e_graos", "hortifruti", "carnes_e_peixes", "embalagens", "limpeza", "outros"];

    const toNumber = (v: any) => {
      if (typeof v === 'number') return v;
      if (!v) return 0;
      const n = parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };

    result.ingredients = (result.ingredients || [])
      .map((ing: any) => {
        const name = String(ing.nome ?? ing.name ?? ing.item ?? ing.descricao ?? ing.produto ?? "").trim();
        if (!name) return null;

        let unitRaw = String(ing.unidade ?? ing.unit ?? ing.un ?? "unidade").toLowerCase().trim();
        if (unitRaw === "l") unitRaw = "L";

        return {
          name,
          quantity: toNumber(ing.quantidade ?? ing.quantity ?? ing.qtd ?? 1),
          unit: validUnits.includes(unitRaw) ? unitRaw : "unidade",
          category: validCategories.includes(String(ing.categoria ?? ing.category).toLowerCase().trim()) ? String(ing.categoria ?? ing.category).toLowerCase().trim() : "outros",
          price: ing.price ?? ing.preco ?? ing.valor ?? null,
          supplier: ing.supplier ?? ing.fornecedor ?? null,
          minimum_quantity: ing.minimum_quantity ?? ing.estoque_minimo ?? null,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Critical error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
