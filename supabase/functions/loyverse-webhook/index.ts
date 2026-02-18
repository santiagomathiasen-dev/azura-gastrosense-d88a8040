import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-loyverse-signature",
};

// Helper to verify HMAC SHA1 signature
async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["verify", "sign"]
    );

    // Loyverse signatures are usually HMAC-SHA1 of the raw body
    const signatureBytes = new Uint8Array(
        signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    return await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        encoder.encode(body)
    );
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const loyverseSecret = Deno.env.get("LOYVERSE_CLIENT_SECRET");

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Get Raw Body, Method & Headers
        const rawBody = await req.text();
        const method = req.method;
        const headers = {};
        req.headers.forEach((value, key) => {
            headers[key] = value;
        });

        let payload = {};
        try {
            payload = JSON.parse(rawBody);
        } catch (e) {
            payload = { raw: rawBody, error: "Invalid JSON" };
        }

        // --- DB LOGGING START ---
        await supabase.from('webhook_logs').insert({
            payload: {
                method: method,
                headers: headers,
                body: payload
            },
            status: 'received',
            error_message: null
        });
        // --- DB LOGGING END ---

        const signature = req.headers.get("x-loyverse-signature");

        if (loyverseSecret && signature) {
            // Secret validation logic (skipped for now as per previous code)
        }

        if (!rawBody) {
            return new Response("Empty body", { status: 400 });
        }

        // 2. Check Event Type
        // We expect a receipt object.
        const receipt = payload.receipts ? payload.receipts[0] : payload;

        if (!receipt || !receipt.line_items) {
            console.log("Ignored event:", payload);
            return new Response(JSON.stringify({ message: "Ignored event" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 3. Map Items
        const soldItems = [];
        const { data: allProducts } = await supabase
            .from("sale_products")
            .select("id, name, is_active");

        const productMap = new Map();
        allProducts?.forEach(p => {
            productMap.set(p.name.toLowerCase(), p.id);
        });

        for (const item of receipt.line_items) {
            const itemName = (item.item_name || "").toLowerCase();
            const azuraProductId = productMap.get(itemName);

            if (azuraProductId) {
                soldItems.push({
                    product_id: azuraProductId,
                    quantity: item.quantity || 1
                });
            } else {
                console.warn(`Product not found in Azura: ${itemName}`);
            }
        }

        if (soldItems.length === 0) {
            await supabase.from('webhook_logs').insert({
                payload: payload,
                status: 'error',
                error_message: "No matching products found"
            });
            return new Response(JSON.stringify({ message: "No matching products found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 4. Create Sale via RPC
        const { data: gestor } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "gestor")
            .limit(1)
            .single();

        const userId = gestor?.id;

        if (!userId) {
            throw new Error("No gestor found to attribute sale");
        }

        const salePayload = {
            date_time: receipt.created_at || new Date().toISOString(),
            payment_method: "Loyverse",
            total_amount: receipt.total_money || 0,
            sold_items: soldItems
        };

        const { data: result, error: rpcError } = await supabase.rpc("process_pos_sale", {
            p_user_id: userId,
            p_sale_payload: salePayload,
        });

        if (rpcError) throw rpcError;

        // Log Success
        await supabase.from('webhook_logs').insert({
            payload: { sale_id: result }, // simplify payload for second log or just log status
            status: 'success',
            error_message: null
        });

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error:", error);

        // Log Error
        try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
            const supabase = createClient(supabaseUrl, supabaseKey);
            await supabase.from('webhook_logs').insert({
                payload: { error_stack: error.stack },
                status: 'error',
                error_message: error.message
            });
        } catch (logError) {
            console.error("Failed to log error to DB:", logError);
        }

        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
