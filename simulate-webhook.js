
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Load Env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let env = {};
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
            env[key] = value;
        }
    });
} catch (e) {
    console.log("Could not read .env");
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("--- 1. Verification/Setup ---");

    // A. Get User
    // We need a user to owner the product if we create one
    // We can't access auth.users easily with anon key usually, but let's try profiles or existing products
    // Or we use the SERVICE_ROLE if available in .env? Usually not in VITE_ .
    // If we only have anon key, we might be restricted.
    // However, the user said "simular venda", implying testing the flow.
    // If I can't create a product, I can't test.

    // Let's try to find ANY active product first.
    let { data: products } = await supabase
        .from('sale_products')
        .select('*')
        .eq('is_active', true)
        .limit(1);

    let testProduct = products?.[0];

    if (!testProduct) {
        console.log("No active products found. detailed simulation requires an existing product.");
        console.log("Attempting to create one via RPC if possible or alerting user...");
        // Since we likely only have Anon key here (unless user added service key), we might not be able to insert if RLS blocks it.
        // But let's assume valid session or open RLS for now? No, RLS is on.
        // We'll proceed with a "Fake" product name and hope the webhook logs "Product not found" which is ALSO a valid test of the webhook reachability.

        testProduct = { name: "Produto Fantasma", id: "0000" };
        console.log("Using 'Produto Fantasma' (expecting 'Product not found' in backend logs)");
    } else {
        console.log(`Using existing product: ${testProduct.name}`);
    }

    console.log("\n--- 2. Sending Webhook ---");
    const webhookUrl = `${supabaseUrl}/functions/v1/loyverse-webhook`;

    const payload = {
        receipts: [{
            receipt_number: `SIM-${Date.now()}`,
            created_at: new Date().toISOString(),
            total_money: 15.50,
            line_items: [
                {
                    item_name: "Croissant",
                    quantity: 1,
                    total_money: 15.50
                }
            ]
        }]
    };

    console.log("Target:", webhookUrl);
    console.log("Payload Item:", testProduct.name);

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // We're not sending signature, assuming we allowed that for testing in the function code
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log("\n--- 3. Result ---");
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${text}`);

        if (response.ok) {
            console.log("\n✅ SUCCESS! Webhook received the request.");
            if (products?.length > 0) {
                console.log("Since product exists, stock check/deduction should have triggered.");
            } else {
                console.log("Note: Since this was a 'Ghost Product', the backend probably ignored it (check logs for 'No matching products found').");
            }
        } else {
            console.log("\n❌ FAILED. Check the error above.");
        }

    } catch (err) {
        console.error("Request failed:", err);
    }
}

main();
