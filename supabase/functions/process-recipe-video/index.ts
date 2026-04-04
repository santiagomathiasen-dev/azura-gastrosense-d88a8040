declare const Deno: any;

// ── CORS absoluto ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonOk = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const jsonError = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Prompt de extração de vídeo ───────────────────────────────────────────────
const PROMPT = `Você é um Chef Assistente. A partir da URL ou descrição de vídeo fornecida, extraia a receita.
Retorne SOMENTE este JSON (nenhum texto fora do JSON):
{
  "name": "nome da receita",
  "preparation_method": "modo de preparo completo em português",
  "techniques": ["técnica1", "técnica2"],
  "estimated_time": 30,
  "ingredients": [
    { "nome": "ingrediente", "quantidade": 1.0, "unidade": "unidade" }
  ]
}`;

// ── OpenAI Chat Completions ───────────────────────────────────────────────────
async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("OpenAI não retornou texto.");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return jsonError("OPENAI_API_KEY não configurada.", 500);

    let body: any;
    try { body = await req.json(); } catch (_) { return jsonError("Body JSON inválido."); }

    const { videoUrl } = body ?? {};
    if (!videoUrl) return jsonError("Campo 'videoUrl' ausente.");

    const fullPrompt = `${PROMPT}\n\nURL/Descrição do vídeo: ${videoUrl}`;
    const rawText = await callOpenAI(OPENAI_API_KEY, fullPrompt);

    let result: any;
    try {
      result = JSON.parse(rawText.trim());
    } catch (_) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch (_2) { return jsonError("Resposta da OpenAI não é JSON válido.", 500); }
      } else {
        return jsonError("Resposta da OpenAI não é JSON válido.", 500);
      }
    }

    // Sanitize estimated_time
    if (result.estimated_time !== undefined) {
      const n = parseInt(String(result.estimated_time).replace(/\D/g, ""));
      result.estimated_time = isNaN(n) ? null : n;
    }

    return jsonOk(result);

  } catch (error: any) {
    console.error("[process-recipe-video] CATCH:", error?.message ?? error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Erro interno.", details: error?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
