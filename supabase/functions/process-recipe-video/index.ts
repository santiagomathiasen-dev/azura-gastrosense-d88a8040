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

// ── Gemini com retry e fallback ────────────────────────────────────────────────
const GEMINI_MODELS: [string, string][] = [
  ["gemini-1.5-flash", "v1"],
  ["gemini-2.5-flash", "v1"],
  ["gemini-flash-latest", "v1"],
];

async function callGemini(apiKey: string, prompt: string): Promise<any> {
  let lastErrorDetails = "";

  for (const [model, apiVersion] of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`[Gemini] Tentando model=${model} api=${apiVersion} attempt=${attempt}`);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        console.log(`[Gemini OK] model=${model} attempt=${attempt}`);
        return json;
      }

      let errBody: any = {};
      try { errBody = await res.clone().json(); } catch (_) {
        try { errBody = { raw: await res.text() }; } catch (_2) { }
      }
      const errMsg = errBody?.error?.message ?? JSON.stringify(errBody);
      lastErrorDetails = `[${model}/${apiVersion}] HTTP ${res.status}: ${errMsg}`;
      console.error("ERRO REAL DO GEMINI:", lastErrorDetails);

      if (res.status === 429) {
        let waitMs = (attempt + 1) * 15000;
        const delay = errBody?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
        if (delay) waitMs = (parseInt(delay) + 3) * 1000;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      break;
    }
  }

  const finalErr: any = new Error("Todos os modelos Gemini falharam.");
  finalErr.details = lastErrorDetails;
  throw finalErr;
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: any) => {
  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return jsonError("GEMINI_API_KEY não configurada.", 500);

    let body: any;
    try { body = await req.json(); } catch (_) { return jsonError("Body JSON inválido."); }

    const { videoUrl } = body ?? {};
    if (!videoUrl) return jsonError("Campo 'videoUrl' ausente.");

    const fullPrompt = `${PROMPT}\n\nURL/Descrição do vídeo: ${videoUrl}`;
    const aiData = await callGemini(GEMINI_API_KEY, fullPrompt);

    const rawText: string = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText) return jsonError("Gemini não retornou dados.", 500);

    let result: any;
    try {
      result = JSON.parse(rawText.trim());
    } catch (_) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) { try { result = JSON.parse(match[0]); } catch (_2) { return jsonError("Resposta do Gemini não é JSON válido.", 500); } }
      else return jsonError("Resposta do Gemini não é JSON válido.", 500);
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
