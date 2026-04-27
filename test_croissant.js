
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Env
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

if (!supabaseUrl) {
    console.error("Missing Supabase URL");
    process.exit(1);
}

async function main() {
    console.log("--- Test Webhook: 'Croissant' ---");
    console.log("Skipping local checks (RLS). Sending webhook directly...");

    // 2. Simulate Webhook
    const webhookUrl = `${supabaseUrl}/functions/v1/loyverse-webhook`;
    const payload = {
        receipts: [{
            receipt_number: `TEST-${Date.now()}`,
            created_at: new Date().toISOString(),
            total_money: 10.00,
            line_items: [
                {
                    item_name: "Croissant",
                    quantity: 2,
                    total_money: 10.00
                }
            ]
        }]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${text}`);

        if (response.ok) {
            console.log("\n✅ SUCCESS! Webhook accepted.");
            if (text.includes("No matching products found")) {
                console.log("⚠️ WARNING: Server reported 'No matching products found'.");
                console.log("   --> Verify 'Croissant' exists in Azura with EXACT name match.");
            }
        } else {
            console.log("\n❌ FAILED. Check payload or logs.");
        }

    } catch (err) {
        console.error("   Request failed:", err);
    }
}

main();
