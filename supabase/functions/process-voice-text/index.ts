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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { text, systemPrompt } = await req.json();

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "Texto vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
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

    // Extract JSON array from the response
    let ingredients: any[] = [];
    try {
      const jsonMatch = assistantMessage.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const raw = jsonMatch[0]
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();
        ingredients = JSON.parse(raw);
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
      console.error("Response was:", assistantMessage);
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

        // Normalize 'l' to 'L' for liters
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
