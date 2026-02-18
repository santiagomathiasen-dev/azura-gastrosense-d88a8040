
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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY; // Check if this exists

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

// Use Service Key if available to bypass RLS for setup
const supabase = createClient(supabaseUrl, serviceKey || supabaseKey);

async function main() {
    console.log("--- Fixing/Setup Integration ---");

    if (serviceKey) {
        console.log("✅ Using Service Role Key (Bypassing RLS)");
    } else {
        console.log("⚠️ Using Anon Key (Subject to RLS)");
    }

    // 1. List Profiles
    console.log("\n1. Listing Profiles...");
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, email, first_name, role');

    if (profileError) {
        console.error("Error fetching profiles:", profileError.message);
    } else {
        if (profiles.length === 0) {
            console.log("❌ No profiles found. You must sign up via the App first.");
        } else {
            console.log("Found profiles:", profiles);

            // If no gestor, try to promote the first one (only works if we have service key or permission)
            const gestor = profiles.find(p => p.role === 'gestor');
            if (!gestor) {
                console.log("Attempting to promote first user to 'gestor'...");
                const firstUser = profiles[0];
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: 'gestor' })
                    .eq('id', firstUser.id);

                if (updateError) {
                    console.error("Failed to promote user:", updateError.message);
                } else {
                    console.log(`✅ Promoted ${firstUser.first_name || firstUser.email} to 'gestor'.`);
                }
            } else {
                console.log(`✅ User ${gestor.first_name || gestor.email} is already 'gestor'.`);
            }
        }
    }

    // 2. Create 'Produto Fantasma'
    console.log("\n2. Creating Test Product 'Produto Fantasma'...");

    // Check if exists
    const { data: existing } = await supabase.from('sale_products').select('id').eq('name', 'Produto Fantasma').single();
    if (existing) {
        console.log("✅ 'Produto Fantasma' already exists.");
        // Ensure it is active
        await supabase.from('sale_products').update({ is_active: true }).eq('id', existing.id);
    } else {
        const { data: newProd, error: createError } = await supabase.from('sale_products').insert({
            name: 'Produto Fantasma',
            sale_price: 10.00,
            is_active: true,
            description: 'Produto para teste de integração'
        }).select().single();

        if (createError) {
            console.error("❌ Failed to create product:", createError.message);
        } else {
            console.log("✅ Created 'Produto Fantasma' with ID:", newProd.id);
        }
    }
}

main();
