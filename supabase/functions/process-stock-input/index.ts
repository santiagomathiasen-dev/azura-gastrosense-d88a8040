// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StockInputRequest {
  type: "voice" | "image";
  content: string;
  stockItems: { id: string; name: string; unit: string; category: string }[];
}

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { type, content, stockItems }: StockInputRequest = await req.json();

    if (!type || !content) {
      return new Response(
        JSON.stringify({ error: "Tipo e conteúdo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stockItemsList = (stockItems || [])
      .map((item) => `- ${item.name} (ID: ${item.id}, unidade: ${item.unit}, category: ${item.category})`)
      .join("\n");

    const promptText = `IA de Estoque Profissional.
Extração direta de JSON.
Ação: entry, exit, adjustment.

ITENS:
${stockItemsList || "Nenhum"}

JSON apenas.`;

    // Build message content depending on input type
    let messageContent: any;
    if (type === "voice") {
      messageContent = `${promptText}\nVoz: "${content}"`;
    } else {
      // Image — use vision
      const base64 = content.includes(",") ? content.split(",")[1] : content;
      messageContent = [
        { type: "text", text: `${promptText}\nAnalise a imagem.` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
      ];
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: messageContent }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com OpenAI", details: errorText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices?.[0]?.message?.content || "";

    if (!assistantMessage) {
      console.error("[process-stock-input] OpenAI retornou vazio.");
      return new Response(
        JSON.stringify({ error: "IA não retornou dados." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON with cleaning and recovery
    let result;
    try {
      let cleaned = assistantMessage.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
      }
      result = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Parse error, trying regex recovery:", parseError);
      try {
        const jsonMatch = assistantMessage.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch (e) {
        console.error("Regex recovery failed:", e);
        result = {
          suggestions: [],
          message: "Não foi possível interpretar a entrada. Tente novamente com mais clareza.",
        };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("process-stock-input error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
