// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_UNITS = ["kg", "g", "L", "ml", "unidade", "caixa", "dz"];
const VALID_CATEGORIES = [
  "laticinios",
  "secos_e_graos",
  "hortifruti",
  "carnes_e_peixes",
  "embalagens",
  "limpeza",
  "outros",
];

const toNumber = (v: any) => {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { content, fileType, extractRecipe, mimeType: customMimeType } = body;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Conteúdo ausente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine effective MIME type
    let mimeType = customMimeType;
    if (!mimeType) {
      if (fileType === "pdf") mimeType = "application/pdf";
      else if (fileType === "image") mimeType = "image/jpeg";
      else mimeType = "text/plain";
    }

    const isBase64 = mimeType !== "text/plain";

    // ─── ULTRA-COMPACT PROMPTS ────────────────────────────────────────────────
    const recipePrompt = `Chef Assistente. PDF/Imagem de receita.
JSON: {"recipeName":str,"preparationMethod":str,"preparationTime":num,"yieldQuantity":num,"labor_cost":num,"energy_cost":num,"other_costs":num,"markup":num,"praca":str,"ingredients":[{"name":str,"quantity":num,"unit":"kg|g|L|ml|unidade|caixa|dz","category":"laticinios|secos_e_graos|hortifruti|carnes_e_peixes|embalagens|limpeza|outros","price":num}],"summary":str}`;

    const ingredientPrompt = `Extrator de Estoque. PDF/Imagem de nota fiscal ou lista.
JSON: {"ingredients":[{"name":str,"quantity":num,"unit":"kg|g|L|ml|unidade|caixa|dz","category":"laticinios|secos_e_graos|hortifruti|carnes_e_peixes|embalagens|limpeza|outros","price":num}],"summary":str}`;

    const prompt = extractRecipe ? recipePrompt : ingredientPrompt;
    // ─────────────────────────────────────────────────────────────────────────

    const parts: any[] = [
      isBase64
        ? { inlineData: { mimeType, data: content } }
        : { text: content },
      { text: prompt },
    ];

    const geminiBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`Gemini error ${geminiRes.status}:`, errText);
      return new Response(
        JSON.stringify({ error: "Erro na API do Gemini.", details: errText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await geminiRes.json();
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) {
      const reason = aiData.candidates?.[0]?.finishReason || "UNKNOWN";
      return new Response(
        JSON.stringify({ ingredients: [], summary: `IA não processou (motivo: ${reason}).` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON (with regex fallback)
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (_) {
      const m = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (_2) { /* ignore */ }
      }
    }

    // Normalize ingredients
    const rawIngredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients
      : Array.isArray(parsed)
      ? parsed
      : [];

    const ingredients = rawIngredients
      .map((ing: any) => {
        const name = String(ing.nome ?? ing.name ?? ing.item ?? ing.descricao ?? ing.produto ?? "").trim();
        if (!name) return null;

        let unit = String(ing.unidade ?? ing.unit ?? ing.un ?? "unidade").toLowerCase().trim();
        if (unit === "l") unit = "L";
        if (!VALID_UNITS.includes(unit)) unit = "unidade";

        const rawCat = String(ing.categoria ?? ing.category ?? "outros").toLowerCase().trim();
        const category = VALID_CATEGORIES.includes(rawCat) ? rawCat : "outros";

        return {
          name,
          quantity: toNumber(ing.quantidade ?? ing.quantity ?? ing.qtd ?? 1),
          unit,
          category,
          price: ing.price ?? ing.preco ?? ing.valor ?? null,
          supplier: ing.supplier ?? ing.fornecedor ?? null,
          minimum_quantity: ing.minimum_quantity ?? ing.estoque_minimo ?? null,
          expiration_date: ing.expiration_date ?? ing.validade ?? ing.vencimento ?? null,
        };
      })
      .filter(Boolean);

    const result = {
      ingredients,
      summary: parsed.summary || `${ingredients.length} item(s) extraído(s).`,
      ...(extractRecipe && {
        recipeName: parsed.recipeName ? String(parsed.recipeName).trim() : undefined,
        preparationMethod: parsed.preparationMethod
          ? String(parsed.preparationMethod).trim()
          : undefined,
        preparationTime: toNumber(parsed.preparationTime),
        yieldQuantity: toNumber(parsed.yieldQuantity),
        labor_cost: toNumber(parsed.labor_cost),
        energy_cost: toNumber(parsed.energy_cost),
        other_costs: toNumber(parsed.other_costs),
        markup: toNumber(parsed.markup),
        praca: parsed.praca ? String(parsed.praca).trim() : undefined,
      }),
    };

    console.log(`Extracted ${ingredients.length} ingredients. extractRecipe=${extractRecipe}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Edge Function Error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno.", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
