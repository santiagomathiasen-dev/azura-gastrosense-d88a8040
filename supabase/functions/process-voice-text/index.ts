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

    const { text, systemPrompt } = await req.json();

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "Texto vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\nTexto para analisar:\n${text}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
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
      console.error("Gemini error:", response.status, errorText);

      let errorMessage = "Erro ao processar com Gemini";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) { }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          status: response.status,
          details: errorText
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Extract JSON array from the response with cleaning and recovery
    let ingredients: any[] = [];
    try {
      let cleanedMessage = assistantMessage.trim();
      if (cleanedMessage.startsWith("```")) {
        cleanedMessage = cleanedMessage.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
      }

      const parsed = JSON.parse(cleanedMessage);
      ingredients = Array.isArray(parsed) ? parsed : (parsed.ingredients || []);
    } catch (parseError) {
      console.error("Parse error, trying regex recovery:", parseError);
      try {
        const jsonMatch = assistantMessage.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          ingredients = Array.isArray(parsed) ? parsed : (parsed.ingredients || []);
        }
      } catch (e) {
        console.error("Regex recovery failed:", e);
      }
    }

    // Normalize and validate
    const validUnits = ["kg", "g", "L", "ml", "unidade", "caixa", "dz"];
    const validCategories = [
      "laticinios",
      "secos_e_graos",
      "hortifruti",
      "carnes_e_peixes",
      "embalagens",
      "limpeza",
      "outros",
    ];

    const normalizedIngredients = ingredients
      .map((ing: any) => {
        const name = String(ing.name || ing.nome || "").trim();
        if (!name) return null;

        let unitRaw = String(ing.unit || ing.unidade || "unidade").toLowerCase().trim();
        const categoryRaw = String(ing.category || ing.categoria || "outros").toLowerCase().trim();

        if (unitRaw === "l") unitRaw = "L";

        return {
          name,
          quantity: Number(ing.quantity ?? ing.quantidade) || 1,
          unit: validUnits.includes(unitRaw) ? unitRaw : "unidade",
          category: validCategories.includes(categoryRaw) ? categoryRaw : "outros",
          price: ing.price ?? ing.preco ?? null,
          supplier: ing.supplier ?? ing.fornecedor ?? null,
        };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({ ingredients: normalizedIngredients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-voice-text error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
