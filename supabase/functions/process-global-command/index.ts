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
            return new Response(
                JSON.stringify({ error: "Chave da IA não encontrada." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { text, path, context } = await req.json();

        const systemPrompt = `Assistente Azura (Gestão Gastronômica).
Página: ${path}
Contexto: ${context}

Determine a intenção e retorne JSON.
Ações:
1. {"action": "navigate", "target": "/rota", "label": "Nome"}
2. {"action": "toast", "message": "Texto"}
3. {"action": "info", "message": "Texto"}

Rotas: /dashboard, /estoque, /fichas, /producao, /financeiro, /compras, /relatorios, /perdas, /previsao-vendas, /produtos-venda, /colaboradores.

JSON apenas.`;

        const geminiBody = {
            contents: [{ parts: [{ text: `${systemPrompt}\n\nComando: "${text}"` }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(geminiBody),
            }
        );

        const aiResponse = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", aiResponse);
            return new Response(JSON.stringify({
                action: "toast",
                message: `Erro na API da IA: ${aiResponse.error?.message || response.statusText}`
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const assistantMessage = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '{"action": "toast", "message": "Não entendi o comando."}';

        return new Response(assistantMessage, {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
