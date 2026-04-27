
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
// Use Anon key - assuming RLS allows Select for auth users, but for script we might need service key if RLS is strict for anon.
// However, I set policy "Users can read logs" for auth.uid() IS NOT NULL.
// Scripts running locally usually don't have auth.uid() unless signed in.
// But I also added "Service Role can read logs".
// So let's try to use Service Role Key if available, else Anon (which might fail if not signed in).
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("--- Checking Webhook Logs ---");

    const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("❌ Error fetching logs:", error.message);
        if (error.code === '42P01') {
            console.log("   (Table 'webhook_logs' might not exist or permissions issue)");
        }
        return;
    }

    if (!logs || logs.length === 0) {
        console.log("⚠️ No logs found. Webhook has NOT been called yet.");
    } else {
        console.log(`✅ Found ${logs.length} logs.`);
        logs.forEach((log, index) => {
            console.log(`\n[${index + 1}] Time: ${log.created_at} | Status: ${log.status}`);
            if (log.error_message) console.log(`    Error: ${log.error_message}`);
            console.log(`    Payload Preview: ${JSON.stringify(log.payload).substring(0, 150)}...`);
        });
    }
}

main();
