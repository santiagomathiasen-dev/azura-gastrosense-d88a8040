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

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
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
            temperature: 0.1,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI error HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI não retornou texto.");
    return text;
}

serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
            return jsonOk({ action: "toast", message: "IA não configurada no servidor (OPENAI_API_KEY ausente)." });
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

        const rawText = await callOpenAI(OPENAI_API_KEY, `${systemPrompt}\n\nComando do usuário: "${text}"`);

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
