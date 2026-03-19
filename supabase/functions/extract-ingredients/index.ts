// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found");
      return new Response(
        JSON.stringify({ error: "Erro de configuração: Chave da IA (GEMINI_API_KEY) não encontrada no servidor." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestBody = await req.json();
    const { content, fileType, extractRecipe, mimeType: customMimeType } = requestBody;

    console.log(`Extraction request: fileType=${fileType}, extractRecipe=${extractRecipe}, mimeType=${customMimeType}`);

    if (!content) {
      console.error("Content is missing in request body");
      return new Response(
        JSON.stringify({ error: "Conteúdo ausente" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine MIME type
    let mimeType = customMimeType;
    if (!mimeType) {
      if (fileType === "pdf") mimeType = "application/pdf";
      else if (fileType === "image") mimeType = "image/jpeg";
      else if (fileType === "text" || fileType === "excel") mimeType = "text/plain";
      else mimeType = "text/plain";
    }

    console.log(`Effective mimeType: ${mimeType}, content length: ${content.length}`);

    // System instruction for better compliance
    const systemPrompt = `Assistente de Gestão Gastronômica. Extraia itens/ingredientes de documentos.
    Unidades: kg, g, L, ml, unidade, caixa, dz.
    Categorias: laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros.
    Retorne apenas JSON válido.`;

    let userPrompt = "";
    if (extractRecipe) {
      userPrompt = `Extraia dados da receita para este JSON:
{
  "recipeName": string, "preparationMethod": string, "preparationTime": number, "yieldQuantity": number,
  "labor_cost": number, "energy_cost": number, "other_costs": number, "markup": number, "praca": string,
  "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string, "price": number}],
  "summary": string
}`;
    } else {
      userPrompt = `Extraia itens para este JSON:
{ "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string, "price": number}], "summary": string }`;
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

    const isBase64 = mimeType !== "text/plain";

    const geminiBody = {
      contents: [
        {
          parts: [
            isBase64
              ? {
                inlineData: {
                  mimeType,
                  data: content,
                },
              }
              : { text: content },
            { text: `Instrução: ${systemPrompt}\n\nTarefa: ${userPrompt}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    console.log("Calling Gemini API...");
    const model = "gemini-2.0-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response';
      }
      console.error(`Gemini request failed with status ${response.status}:`, errorText);

      let modelsList = '';
      if (response.status === 404 || response.status === 403 || response.status === 400 || response.status === 429) {
        try {
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            modelsList = JSON.stringify(modelsData);
          }
        } catch (e) { }
      }

      return new Response(
        JSON.stringify({ error: "Erro na api do gemini", details: errorText, availableModels: modelsList }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiResponse;
    try {
      aiResponse = await response.json();
    } catch (e) {
      console.error("Gemini response is not valid JSON.");
      return new Response(
        JSON.stringify({ error: "Resposta inválida da API do Gemini." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Gemini response received");

    const assistantMessage = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!assistantMessage) {
      const finishReason = aiResponse.candidates?.[0]?.finishReason || "UNKNOWN";
      const safetyRatings = aiResponse.candidates?.[0]?.safetyRatings;
      console.warn("Gemini returned empty message. Finish reason:", finishReason, "Safety:", JSON.stringify(safetyRatings));

      return new Response(
        JSON.stringify({
          ingredients: [],
          summary: `A IA não conseguiu processar o documento. Motivo: ${finishReason}. Verifique se o conteúdo é sensível ou se o arquivo está corrompido.`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any = { ingredients: [], summary: "" };

    try {
      const cleanMessage = assistantMessage.trim();
      const parsed = JSON.parse(cleanMessage);
      result = {
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : (Array.isArray(parsed) ? parsed : []),
        summary: parsed.summary || "",
        recipeName: parsed.recipeName ? String(parsed.recipeName).trim() : undefined,
        preparationMethod: parsed.preparationMethod ? String(parsed.preparationMethod).trim() : undefined,
        preparationTime: toNumber(parsed.preparationTime),
        yieldQuantity: toNumber(parsed.yieldQuantity),
        labor_cost: toNumber(parsed.labor_cost),
        energy_cost: toNumber(parsed.energy_cost),
        other_costs: toNumber(parsed.other_costs),
        markup: toNumber(parsed.markup),
        praca: parsed.praca ? String(parsed.praca).trim() : undefined,
      };
    } catch (e) {
      console.error("Failed to parse Gemini response as JSON. Content:", assistantMessage.substring(0, 200));
      // Fallback regex attempt
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
            labor_cost: toNumber(parsed.labor_cost),
            energy_cost: toNumber(parsed.energy_cost),
            other_costs: toNumber(parsed.other_costs),
            markup: toNumber(parsed.markup),
            praca: parsed.praca ? String(parsed.praca).trim() : undefined,
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

    console.log(`Successfully extracted ${result.ingredients.length} ingredients`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Critical Edge Function Error:", error);
    return new Response(
      JSON.stringify({
        error: "Erro na extração de ingredientes. Verifique se o arquivo é um PDF/Imagem válido.",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
