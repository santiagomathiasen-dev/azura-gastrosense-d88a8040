
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const webhookUrl = `${supabaseUrl}/functions/v1/loyverse-webhook`;
    console.log(`Testing URL: ${webhookUrl}`);

    const payload = {
        receipts: [{
            receipt_number: `DEBUG-${Date.now()}`,
            created_at: new Date().toISOString(),
            total_money: 12.00,
            line_items: [
                {
                    item_name: "Croissant",
                    quantity: 1,
                    total_money: 12.00
                }
            ]
        }]
    };

    try {
        console.log("Sending request...");
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Body: ${text}`);

    } catch (err) {
        console.error("Request failed:", err);
    }
}

main();
