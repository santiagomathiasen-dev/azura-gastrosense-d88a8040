// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-auth, x-supabase-client-platform, x-supabase-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // --- DEBUG LOGS ---
  console.log(`[DEBUG] Received ${req.method} request to ${req.url}`);
  const allHeaders = Object.fromEntries(req.headers.entries());
  console.log("[DEBUG] Headers:", JSON.stringify(allHeaders));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text();
    console.log("[DEBUG] Raw Body:", bodyText);
    
    let payload = {};
    try {
        payload = JSON.parse(bodyText);
    } catch (e) {
        console.error("[DEBUG] Error parsing JSON body:", e.message);
    }

    const { integration_id } = payload;
    if (!integration_id) {
      console.error("[DEBUG] Error: Missing integration_id");
      return new Response(JSON.stringify({ error: "Missing integration_id" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get Loyverse token and user context
    let loyverseToken = Deno.env.get('LOYVERSE_API_KEY');
    
    const { data: integration, error: intError } = await supabase
      .from('pos_integrations')
      .select('*')
      .eq('id', integration_id)
      .single();
    
    if (intError || !integration) {
      console.error(`[DEBUG] Integration ${integration_id} not found in DB`);
      throw new Error(`Integração não encontrada`);
    }

    const userId = integration.user_id;
    if (!loyverseToken) {
      loyverseToken = integration.credentials?.access_token || integration.credentials?.api_key;
    }

    if (!loyverseToken) {
      console.error("[DEBUG] Error: Loyverse API key not found in Secrets or DB");
      return new Response(JSON.stringify({ error: "Loyverse API key missing (401)" }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const loyHeaders = { 
      'Authorization': `Bearer ${loyverseToken}`, 
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    console.log(`[DEBUG] Starting sync for user ${userId} using Loyverse Token: ${loyverseToken.substring(0, 5)}...`);

    // --- PUSH: Azura -> Loyverse ---
    const { data: azuraProducts } = await supabase
      .from('sale_products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    const pushResults = { created: 0, updated: 0, errors: [] };

    if (azuraProducts && azuraProducts.length > 0) {
      const itemsRes = await fetch('https://api.loyverse.com/v1.0/items?limit=250', { headers: loyHeaders });
      
      if (itemsRes.status === 401) {
        console.error("[DEBUG] Loyverse API returned 401 (Invalid Loyverse Token)");
        return new Response(JSON.stringify({ error: "Chave do Loyverse Inválida (401)" }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { items: loyItems = [] } = await itemsRes.json();
      const loyItemMap = new Map(loyItems.map(item => [item.item_name?.toLowerCase().trim(), item]));

      for (const prod of azuraProducts) {
        const existingItem = loyItemMap.get(prod.name.toLowerCase().trim());
        const itemPayload = {
          item_name: prod.name,
          sku: prod.sku || `AZ-${prod.id.substring(0,8)}`,
          price: prod.sale_price || 0,
          description: prod.description || '',
        };

        try {
          if (existingItem) {
            await fetch(`https://api.loyverse.com/v1.0/items/${existingItem.id}`, {
              method: 'PATCH',
              headers: loyHeaders,
              body: JSON.stringify(itemPayload)
            });
            pushResults.updated++;
          } else {
            await fetch('https://api.loyverse.com/v1.0/items', {
              method: 'POST',
              headers: loyHeaders,
              body: JSON.stringify(itemPayload)
            });
            pushResults.created++;
          }
        } catch (e) {
          pushResults.errors.push(`${prod.name}: ${e.message}`);
        }
      }
    }

    // --- PULL: Loyverse -> Azura ---
    const pullSince = integration.last_sync_at || new Date(Date.now() - 86400000).toISOString();
    console.log(`[DEBUG] Fetching Loyverse receipts since: ${pullSince}`);
    
    const receiptsRes = await fetch(`https://api.loyverse.com/v1.0/receipts?updated_at_min=${pullSince}&limit=50`, {
        headers: loyHeaders
    });
    
    if (receiptsRes.ok) {
        const { receipts = [] } = await receiptsRes.json();
        const { data: allSalesProds } = await supabase.from('sale_products').select('id, name').eq('user_id', userId).eq('is_active', true);
        const saleProdMap = new Map(allSalesProds?.map(p => [p.name.toLowerCase().trim(), p.id]));

        let pulledCount = 0;
        for (const receipt of receipts) {
            if (receipt.receipt_type !== 'SALE') continue;

            const soldItems = receipt.line_items?.map(item => {
                const azuraId = saleProdMap.get((item.item_name || "").toLowerCase().trim());
                return azuraId ? { product_id: azuraId, quantity: item.quantity || 1 } : null;
            }).filter(Boolean);

            if (soldItems && soldItems.length > 0) {
                const { error: rpcErr } = await supabase.rpc('process_pos_sale', {
                    p_user_id: userId,
                    p_sale_payload: {
                        date_time: receipt.created_at,
                        payment_method: receipt.payment_type || 'Loyverse',
                        sold_items: soldItems
                    }
                });
                if (!rpcErr) pulledCount++;
            }
        }
        pushResults.pulled = pulledCount;
    } else {
        console.error(`[DEBUG] Failed to pull receipts: ${receiptsRes.status} ${receiptsRes.statusText}`);
    }

    await supabase.from('pos_integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration_id);

    console.log("[DEBUG] Sync Success!");
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Sincronização concluída com sucesso!", 
      push: pushResults 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[DEBUG] CRITICAL ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
