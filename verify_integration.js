
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
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("--- Verifying Integration Prerequisites ---");

    // 1. Check if 'api_keys' table exists (by trying to select from it)
    console.log("\n1. Checking 'api_keys' table...");
    const { error: tableError } = await supabase.from('api_keys').select('id').limit(1);
    if (tableError) {
        if (tableError.code === '42P01') { // undefined_table
            console.error("❌ 'api_keys' table DOES NOT exist.");
        } else {
            console.error("⚠️ Error checking table:", tableError.message);
        }
    } else {
        console.log("✅ 'api_keys' table exists.");
    }

    // 2. Check for 'process_pos_sale' RPC (by trying to call it with invalid args to see if it exists vs 404)
    // Actually, listing functions is hard via client. We can try to call it.
    console.log("\n2. Checking 'process_pos_sale' function...");
    const { error: rpcError } = await supabase.rpc('process_pos_sale', { p_user_id: '00000000-0000-0000-0000-000000000000', p_sale_payload: {} });

    // If function is missing, usually returns error code for "function not found" or 404-like from REST
    if (rpcError) {
        if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
            console.error("❌ 'process_pos_sale' function DOES NOT exist.");
        } else if (rpcError.code === 'PGRST202') { // Function not found (sometimes)
            console.error("❌ 'process_pos_sale' function NOT found.");
        } else {
            // If it failed due to RLS or invalid args, it EXISTS.
            console.log(`✅ 'process_pos_sale' function appears to exist (Error was: ${rpcError.message} - expected for invalid args).`);
        }
    } else {
        // If it somehow worked with empty args
        console.log("✅ 'process_pos_sale' function exists.");
    }

    // 3. Check for specific user 'santiago.aloom@gmail.com'
    console.log("\n3. Checking for user 'santiago.aloom@gmail.com'...");
    const { data: specificUser } = await supabase.from('profiles').select('id, email, full_name, role').eq('email', 'santiago.aloom@gmail.com').maybeSingle();

    if (specificUser) {
        console.log(`✅ Found user: ${specificUser.email} (${specificUser.id})`);
        console.log(`   Role: ${specificUser.role}`);
        if (specificUser.role !== 'gestor') {
            console.warn("⚠️ User exists but is NOT 'gestor'. Webhook might be picking another user or failing.");
        } else {
            console.log("✅ User has 'gestor' role. Should receive sales.");
        }
    } else {
        console.error("❌ User 'santiago.aloom@gmail.com' NOT found in profiles.");

        // List all users to see what's there
        const { data: allusers } = await supabase.from('profiles').select('email, role').limit(5);
        console.log("   Available users:", allusers);
    }

    // 4. Check for 'Produto Fantasma' or any active product
    console.log("\n4. Checking for Active Products...");
    const { data: products } = await supabase.from('sale_products').select('id, name').eq('is_active', true).limit(5);
    if (products && products.length > 0) {
        console.log(`✅ Found ${products.length} active products.`);
        products.forEach(p => console.log(`   - ${p.name}`));

        const ghost = products.find(p => p.name === 'Produto Fantasma');
        if (ghost) {
            console.log("   (Includes 'Produto Fantasma' for testing)");
        } else {
            console.log("   (No 'Produto Fantasma' found - you might want to create one for the simulation script)");
        }
    } else {
        console.error("❌ No active products found.");
    }
}

main();
