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

interface StockSuggestion {
  itemName: string;
  matchedItemId?: string;
  quantity: number;
  unit: string;
  action: "entry" | "exit" | "adjustment";
  confidence: number;
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { type, content, stockItems }: StockInputRequest = await req.json();

    // Validate input
    if (!type || !content) {
      return new Response(
        JSON.stringify({ error: "Tipo e conteúdo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["voice", "image"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Tipo deve ser 'voice' ou 'image'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify stockItems belong to the authenticated user
    if (stockItems && stockItems.length > 0) {
      const stockItemIds = stockItems.map((item) => item.id);
      const { data: userItems, error: itemsError } = await supabaseClient
        .from("stock_items")
        .select("id")
        .eq("user_id", userId)
        .in("id", stockItemIds);

      if (itemsError) {
        return new Response(
          JSON.stringify({ error: "Erro ao verificar itens de estoque" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validIds = new Set(userItems?.map((item) => item.id) || []);
      const invalidItems = stockItems.filter((item) => !validIds.has(item.id));
      
      if (invalidItems.length > 0) {
        return new Response(
          JSON.stringify({ error: "Acesso negado a alguns itens de estoque" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const stockItemsList = (stockItems || [])
      .map((item) => `- ${item.name} (ID: ${item.id}, unidade: ${item.unit}, categoria: ${item.category})`)
      .join("\n");

    let systemPrompt = `Você é um assistente especializado em gestão de estoque para cozinhas profissionais.
Sua tarefa é interpretar comandos e extrair informações sobre movimentações de estoque.

LISTA DE ITENS NO ESTOQUE:
${stockItemsList || "Nenhum item cadastrado"}

REGRAS:
1. Sempre tente associar o item mencionado a um item existente no estoque
2. Se não encontrar correspondência exata, sugira o item mais similar
3. Interprete unidades corretamente (kg, g, L, ml, unidade, caixa, dz)
4. Determine se é entrada, saída ou ajuste de estoque
5. Retorne SEMPRE um JSON válido com o formato especificado

FORMATO DE RESPOSTA (JSON):
{
  "suggestions": [
    {
      "itemName": "nome do item mencionado",
      "matchedItemId": "id do item correspondente ou null",
      "quantity": 0,
      "unit": "unidade de medida",
      "action": "entry|exit|adjustment",
      "confidence": 0.0
    }
  ],
  "message": "mensagem explicativa para o usuário"
}`;

    let userContent: any;

    if (type === "voice") {
      userContent = `Interprete o seguinte comando de voz e extraia as informações de estoque:

"${content}"

Retorne um JSON com as sugestões de movimentação.`;
    } else {
      userContent = [
        {
          type: "text",
          text: `Analise esta imagem (pode ser foto de estoque, nota fiscal, ou lista de produtos) e extraia as informações de itens e quantidades.

Tente associar cada item identificado com os itens existentes no estoque.
Retorne um JSON com as sugestões de movimentação.`,
        },
        {
          type: "image_url",
          image_url: {
            url: content.startsWith("data:") ? content : `data:image/jpeg;base64,${content}`,
          },
        },
      ];
    }

    

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices?.[0]?.message?.content || "";

    // Extract JSON from the response
    let result;
    try {
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      result = {
        suggestions: [],
        message: "Não foi possível interpretar a entrada. Tente novamente com mais clareza.",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
