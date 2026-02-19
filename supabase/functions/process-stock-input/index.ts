import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StockInputRequest {
  type: "voice" | "image";
  content: string;
  stockItems: { id: string; name: string; unit: string; category: string }[];
}

serve(async (req) => {
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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { type, content, stockItems }: StockInputRequest = await req.json();

    // Validate input
    if (!type || !content) {
      return new Response(
        JSON.stringify({ error: "Tipo e conteúdo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stockItemsList = (stockItems || [])
      .map((item) => `- ${item.name} (ID: ${item.id}, unidade: ${item.unit}, category: ${item.category})`)
      .join("\n");

    const promptText = `Você é um assistente especializado em gestão de estoque para cozinhas profissionais.
Tarefa: Interpretar comandos e extrair informações sobre movimentações de estoque.

LISTA DE ITENS NO ESTOQUE:
${stockItemsList || "Nenhum item cadastrado"}

REGRAS:
1. Associe o item ao estoque (ID correspondente).
2. Se não encontrar, sugira o item mais similar com matchedItemId: null.
3. Ações válidas: entry (entrada), exit (saída), adjustment (ajuste).
4. Retorne um JSON com a estrutura:
{
  "suggestions": [
    {
      "itemName": string,
      "matchedItemId": string | null,
      "quantity": number,
      "unit": string,
      "action": "entry"|"exit"|"adjustment",
      "confidence": number
    }
  ],
  "message": string
}`;

    const parts: any[] = [{ text: promptText }];

    if (type === "voice") {
      parts.push({ text: `Comando de voz: "${content}"` });
    } else {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: content.includes(",") ? content.split(",")[1] : content,
        },
      });
      parts.push({ text: "Analise esta imagem e extraia as movimentações." });
    }

    const geminiBody = {
      contents: [{ parts }],
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
    const assistantMessage = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Extract JSON from the response with cleaning and recovery
    let result;
    try {
      let cleanedMessage = assistantMessage.trim();
      if (cleanedMessage.startsWith("```")) {
        cleanedMessage = cleanedMessage.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
      }

      result = JSON.parse(cleanedMessage);
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
