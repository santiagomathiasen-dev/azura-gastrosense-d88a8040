
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env manually
let env = {};
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            // Join rest parts in case value has =
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
    console.error("Missing Supabase URL or Key in .env");
    process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching active products...");
    const { data: products, error } = await client
        .from('sale_products')
        .select('id, name')
        .eq('is_active', true)
        .limit(3);

    if (error) {
        console.error('Error fetching products:', error);
    } else {
        console.log('--- Active Products ---');
        products.forEach(p => console.log(`Name: "${p.name}" | ID: ${p.id}`));
        console.log('-----------------------');

        if (products.length > 0) {
            console.log("\nTo test webhook, you can simulate a sale for: " + products[0].name);

            // Construct a curl command for the user
            const webhookUrl = `${supabaseUrl}/functions/v1/loyverse-webhook`;
            console.log(`\nCURL Command Example:`);
            console.log(`curl -X POST "${webhookUrl}" \\`);
            console.log(`  -H "Content-Type: application/json" \\`);
            console.log(`  -d '{"receipts": [{"receipt_number": "TEST-001", "created_at": "${new Date().toISOString()}", "total_money": 10.00, "line_items": [{"item_name": "${products[0].name}", "quantity": 1, "total_money": 10.00}]}]}'`);
        } else {
            console.log("No active products found to test.");
        }
    }
}

main();
