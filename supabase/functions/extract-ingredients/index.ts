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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { content, fileType, extractRecipe } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Conteúdo ausente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt based on whether we're extracting recipe data too
    let systemPrompt = `Você é um assistente especializado em extrair ingredientes de documentos como notas fiscais, planilhas, listas de compras e receitas.
Retorne SOMENTE um objeto JSON válido com os dados extraídos.`;

    if (extractRecipe) {
      systemPrompt += `

O objeto deve ter a seguinte estrutura:
{
  "recipeName": "nome da receita se encontrado",
  "preparationMethod": "modo de preparo se encontrado",
  "preparationTime": número em minutos se encontrado,
  "yieldQuantity": número de porções/unidades se encontrado,
  "ingredients": [array de ingredientes],
  "summary": "resumo breve do que foi extraído"
}`;
    } else {
      systemPrompt += `

O objeto deve ter a seguinte estrutura:
{
  "ingredients": [array de ingredientes],
  "summary": "resumo breve do que foi extraído"
}`;
    }

    systemPrompt += `

Cada ingrediente no array "ingredients" deve ter:
- name (string): nome do ingrediente
- quantity (number): quantidade
- unit (string): unidade (kg, g, l, ml, unidade, caixa, dz)
- category (string): categoria (laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros)
- preco (number ou null): preço unitário se disponível
- fornecedor (string ou null): nome do fornecedor se disponível

Exemplo de resposta:
{"recipeName": "Bolo de Chocolate", "preparationMethod": "Misture os ingredientes...", "preparationTime": 60, "yieldQuantity": 12, "ingredients": [{"name": "Farinha de trigo", "quantity": 0.5, "unit": "kg", "category": "secos_e_graos", "preco": 4.50, "fornecedor": null}], "summary": "Receita de bolo com 5 ingredientes"}`;

    // Build messages array based on file type
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (fileType === "image") {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: extractRecipe ? "Extraia os dados da receita e ingredientes desta imagem:" : "Extraia os ingredientes desta imagem:" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${content}` } }
        ]
      });
    } else if (fileType === "pdf") {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: extractRecipe ? "Extraia os dados da receita e ingredientes deste PDF:" : "Extraia os ingredientes deste PDF:" },
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${content}` } }
        ]
      });
    } else {
      // Text content
      messages.push({
        role: "user",
        content: extractRecipe ? `Extraia os dados da receita e ingredientes do seguinte texto:\n\n${content}` : `Extraia os ingredientes do seguinte texto:\n\n${content}`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices?.[0]?.message?.content || "";

    let result: { 
      ingredients: any[]; 
      summary: string;
      recipeName?: string;
      preparationMethod?: string;
      preparationTime?: number;
      yieldQuantity?: number;
    };

    try {
      // Try to parse as JSON object first
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        const raw = jsonMatch[0]
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        const parsed = JSON.parse(raw);

        result = {
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
          summary: parsed.summary || "",
          recipeName: parsed.recipeName,
          preparationMethod: parsed.preparationMethod,
          preparationTime: parsed.preparationTime,
          yieldQuantity: parsed.yieldQuantity,
        };
      } else {
        // Fallback: try to parse as array (old format)
        const arrMatch = assistantMessage.match(/\[[\s\S]*\]/);
        if (arrMatch && arrMatch[0]) {
          const raw = arrMatch[0]
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

          const parsed = JSON.parse(raw);

          result = {
            ingredients: Array.isArray(parsed) ? parsed : [],
            summary: "",
          };
        } else {
          result = { ingredients: [], summary: "" };
        }
      }

      console.log("extract-ingredients: parsed ingredients count", result.ingredients.length);
    } catch (parseError) {
      console.error("extract-ingredients: parse failed", {
        preview: assistantMessage.slice(0, 800),
        error: String(parseError),
      });

      result = {
        ingredients: [],
        summary: "Não foi possível extrair ingredientes do documento.",
      };
    }

    // Normalization and validation
    const validCategories = [
      "laticinios",
      "secos_e_graos",
      "hortifruti",
      "carnes_e_peixes",
      "embalagens",
      "limpeza",
      "outros",
    ];

    const validUnits = ["kg", "g", "L", "ml", "unidade", "caixa", "dz"];

    const normalize = (v?: string) => String(v || "").toLowerCase().trim();
    const toNumber = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    result.ingredients = (result.ingredients || [])
      .map((ing: any) => {
        const name = String(ing.nome ?? ing.name ?? "").trim();
        if (!name) return null;

        let unitRaw = normalize(ing.unidade ?? ing.unit);
        const categoryRaw = normalize(ing.categoria ?? ing.category);

        // Normalize 'l' to 'L' for liters
        if (unitRaw === "l") unitRaw = "L";

        return {
          name,
          quantity: toNumber(ing.quantidade ?? ing.quantity),
          unit: validUnits.includes(unitRaw) ? unitRaw : "unidade",
          category: validCategories.includes(categoryRaw) ? categoryRaw : "outros",
          price: ing.preco !== null && ing.preco !== undefined ? toNumber(ing.preco) : null,
          supplier: ing.fornecedor ?? null,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-ingredients error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
