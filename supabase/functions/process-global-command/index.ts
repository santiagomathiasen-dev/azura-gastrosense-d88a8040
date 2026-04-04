// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Always return 200 — supabase.functions.invoke puts non-2xx into opaque FunctionsHttpError
function jsonOk(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

const GEMINI_MODELS: [string, string][] = [
    ["gemini-1.5-flash", "v1"],
    ["gemini-1.5-flash", "v1"],
    ["gemini-1.5-flash", "v1beta"],
    ["gemini-1.5-flash-latest", "v1beta"],
];

async function callGemini(apiKey: string, body: unknown): Promise<string> {
    for (const [model, apiVersion] of GEMINI_MODELS) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        );

        if (res.ok) {
            const json = await res.json();
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
            // finishReason empty — try next model
            const reason = json?.candidates?.[0]?.finishReason ?? "UNKNOWN";
            console.warn(`[GlobalAI] model=${model} finishReason=${reason} — sem texto`);
            continue;
        }

        let errBody: any = {};
        try { errBody = await res.json(); } catch (_) { }
        const errMsg = errBody?.error?.message ?? `HTTP ${res.status}`;
        console.error(`[GlobalAI] model=${model} api=${apiVersion} ERRO: ${errMsg}`);

        if (res.status === 429) {
            await new Promise(r => setTimeout(r, 15_000));
            continue;
        }
        // 404 or other non-retryable → try next model
    }
    throw new Error("Todos os modelos Gemini falharam.");
}

serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            return jsonOk({ action: "toast", message: "IA não configurada no servidor (GEMINI_API_KEY ausente)." });
        }

        const { text, path, context } = await req.json();
        if (!text?.trim()) {
            return jsonOk({ action: "toast", message: "Nenhum comando recebido." });
        }

        const systemPrompt = `Assistente Azura (Gestão Gastronômica).
Página atual: ${path}
Contexto da tela: ${(context || "").substring(0, 1500)}

Determine a intenção do usuário e retorne JSON.
Ações disponíveis:
1. {"action": "navigate", "target": "/rota", "label": "Nome da página"}
2. {"action": "toast", "message": "Texto informativo"}
3. {"action": "info", "message": "Resposta direta à pergunta"}

Rotas válidas: /dashboard, /estoque, /fichas, /producao, /financeiro, /compras, /relatorios, /perdas, /previsao-vendas, /produtos-venda, /colaboradores.

Retorne SOMENTE JSON válido, sem texto fora do JSON.`;

        const geminiBody = {
            contents: [{ parts: [{ text: `${systemPrompt}\n\nComando do usuário: "${text}"` }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        };

        const rawText = await callGemini(GEMINI_API_KEY, geminiBody);

        // Parse and return
        let parsed: any;
        try {
            parsed = JSON.parse(rawText.trim());
        } catch (_) {
            const match = rawText.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { action: "toast", message: rawText };
        }

        return jsonOk(parsed);

    } catch (error: any) {
        console.error("[GlobalAI] Erro:", error?.message ?? error);
        return jsonOk({ action: "toast", message: `Erro na IA: ${error?.message ?? "Erro interno."}` });
    }
});
