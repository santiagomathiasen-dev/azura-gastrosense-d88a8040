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
      return new Response(
        JSON.stringify({ error: "Erro de configuração: Chave da IA (GEMINI_API_KEY) não encontrada no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { content, fileType, extractRecipe, mimeType: customMimeType } = await req.json();

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
1. Analise INTEGRALMENTE o documento, percorrendo todas as páginas e colunas (especialmente em notas fiscais e listas longas).
2. Identifique nomes de produtos, quantidades, unidades de medida, preços unitários ou totais e, SE DISPONÍVEL, a data de validade/vencimento.
3. Se for uma Nota Fiscal (NF), extraia cada item da lista de produtos.
4. Categorias válidas: laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros.
5. Unidades permitidas: kg, g, L, ml, unidade, caixa, dz.
6. Retorne SEMPRE um JSON válido.
7. No campo "summary", descreva brevemente o que encontrou.`;

    let userPrompt = "";
    if (extractRecipe) {
      userPrompt = `Extraia os dados da receita e cada ingrediente individual para este JSON:
{
  "recipeName": "nome da receita",
  "preparationMethod": "passo a passo detalhado",
  "preparationTime": minutos (número),
  "yieldQuantity": porções (número),
  "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string, "price": number, "supplier": string, "minimum_quantity": number, "expiration_date": "YYYY-MM-DD" ou null}],
  "summary": "resumo do que foi extraído"
}`;
    } else {
      userPrompt = `Extraia todos os itens e produtos encontrados no documento para este JSON:
{
  "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string, "price": number, "supplier": string, "minimum_quantity": number, "expiration_date": "YYYY-MM-DD" ou null}],
  "summary": "resumo do que foi extraído"
}`;
    }

    // Normalization Helpers
    const validUnits = ["kg", "g", "L", "ml", "unidade", "caixa", "dz"];
    const validCategories = ["laticinios", "secos_e_graos", "hortifruti", "carnes_e_peixes", "embalagens", "limpeza", "outros"];

    const toNumber = (v: any) => {
      if (typeof v === 'number') return v;
      if (!v) return 0;
      const n = parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };

    // Determine MIME type
    let mimeType = customMimeType;
    if (!mimeType) {
      if (fileType === "pdf") mimeType = "application/pdf";
      else if (fileType === "image") mimeType = "image/jpeg";
      else if (fileType === "text" || fileType === "excel") mimeType = "text/plain";
      else mimeType = "text/plain";
    }

    console.log(`Analyzing file with mimeType: ${mimeType}`);

    const geminiBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          parts: [
            mimeType === "text/plain"
              ? { text: `Documento para analisar (pode conter texto ou base64):\n${content}\n\n${userPrompt}` }
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
        temperature: 0.1,
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
          summary: `A IA não conseguiu processar o documento. Motivo: ${finishReason}.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any = { ingredients: [], summary: "" };

    try {
      const parsed = JSON.parse(assistantMessage.trim());
      result = {
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : (Array.isArray(parsed) ? parsed : []),
        summary: parsed.summary || "",
        recipeName: parsed.recipeName ? String(parsed.recipeName).trim() : undefined,
        preparationMethod: parsed.preparationMethod ? String(parsed.preparationMethod).trim() : undefined,
        preparationTime: toNumber(parsed.preparationTime),
        yieldQuantity: toNumber(parsed.yieldQuantity),
      };
    } catch (e) {
      console.error("Parse failure, attempting regex recovery");
      const match = assistantMessage.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          result = {
            ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : (Array.isArray(parsed) ? parsed : []),
            summary: parsed.summary || "Recuperado via regex",
            recipeName: parsed.recipeName ? String(parsed.recipeName).trim() : undefined,
            preparationMethod: parsed.preparationMethod ? String(parsed.preparationMethod).trim() : undefined,
            preparationTime: toNumber(parsed.preparationTime),
            yieldQuantity: toNumber(parsed.yieldQuantity),
          };
        } catch (e2) {
          result.summary = "Erro de formato na resposta da IA.";
        }
      }
    }

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
          expiration_date: ing.expiration_date ?? ing.validade ?? ing.vencimento ?? null,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Critical error:", error);
    return new Response(
      JSON.stringify({
        error: "Erro na extração de ingredientes. Verifique se o arquivo é um PDF/Imagem válido e se a chave GEMINI_API_KEY está configurada.",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
