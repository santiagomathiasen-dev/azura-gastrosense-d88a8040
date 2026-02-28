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

        const systemPrompt = `Você é o assistente inteligente do Azura, um sistema de gestão gastronômica.
Você recebeu um comando de voz do usuário.
Página atual: ${path}
Conteúdo visível da página (contexto): ${context}

Determine a intenção do usuário e retorne um JSON com a ação a ser tomada.
Ações possíveis:
1. {"action": "navigate", "target": "/estoque", "label": "Estoque"} - Mudar de página.
2. {"action": "toast", "message": "Texto da resposta"} - Dar uma resposta rápida ou informação.
3. {"action": "info", "message": "Texto longo"} - Explicar algo.

Rotas disponíveis:
/dashboard, /estoque, /fichas, /producao, /financeiro, /compras, /relatorios, /perdas, /previsao-vendas, /produtos-venda, /colaboradores.

Se o usuário perguntar algo sobre os dados que estão no contexto (ex: "Qual o custo do item X?"), responda usando a ação "toast".
Se ele quiser ir para algum lugar, use "navigate".

Retorne APENAS o JSON.`;

        const geminiBody = {
            contents: [{ parts: [{ text: `${systemPrompt}\n\nComando do usuário: "${text}"` }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
