
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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceCreate() {
    console.log("--- Force Creating Stock & Link ---");

    // 1. Get User ID (Santiago)
    // We try to find any user to assign owner, preferably Santiago
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    let userId = null;
    if (users && users.users.length > 0) {
        // Try to find santiago
        const santiago = users.users.find(u => u.email?.includes('santiago'));
        userId = santiago ? santiago.id : users.users[0].id; // Fallback to first user
        console.log(`Using User ID: ${userId} (${santiago ? 'Santiago' : 'First User'})`);
    } else {
        console.error("❌ No users found to assign stock owner!");
        return;
    }

    // 2. Create Stock Item if not exists
    const stockName = 'Croissant (Estoque)';

    // Check first
    const { data: existingStock } = await supabase
        .from('stock_items')
        .select('id')
        .eq('name', stockName)
        .single();

    let stockId = existingStock?.id;

    if (!stockId) {
        console.log(`Creating Stock Item: ${stockName}...`);
        const { data: newStock, error: createError } = await supabase
            .from('stock_items')
            .insert({
                user_id: userId,
                name: stockName,
                unit: 'unidade',
                current_quantity: 100,
                minimum_quantity: 10
            })
            .select()
            .single();

        if (createError) {
            console.error("❌ Failed to create stock:", createError.message);
            return;
        }
        stockId = newStock.id;
        console.log(`✅ Created Stock Item: ${stockId}`);
    } else {
        console.log(`ℹ️ Stock Item already exists: ${stockId}`);
        // Reset quantity just in case
        await supabase.from('stock_items').update({ current_quantity: 100 }).eq('id', stockId);
        console.log("   (Reset quantity to 100)");
    }

    // 3. Link to Sale Product
    // We need to find the sale product. If it doesn't exist (because sync didn't happen?), we can't link.
    // Let's check for 'Croissant' or similar.
    const { data: products } = await supabase
        .from('sale_products')
        .select('id, name')
        .ilike('name', '%Croissant%'); // Loose search

    if (!products || products.length === 0) {
        console.log("❌ Sale Product 'Croissant' NOT FOUND in Azura.");
        console.log("   (Has the Loyverse sync happened? Did the user run a sync?)");
        console.log("   I will create a dummy 'Croissant' sale product just to test the link, if you want.");
        // Proceeding to create one for testing? No, might confuse user. 
        // Let's report this.
        return;
    }

    const saleProduct = products[0]; // Take first match
    console.log(`Found Sale Product: ${saleProduct.name} (${saleProduct.id})`);

    // Clean existing links
    await supabase.from('sale_product_components').delete().eq('sale_product_id', saleProduct.id);

    // Create Link
    const { error: linkError } = await supabase
        .from('sale_product_components')
        .insert({
            sale_product_id: saleProduct.id,
            component_type: 'stock_item',
            component_id: stockId,
            quantity: 1,
            unit: 'unidade'
        });

    if (linkError) {
        console.error("❌ Failed to link:", linkError.message);
    } else {
        console.log("✅ Linked 'Croissant' Sale Product to 'Croissant (Estoque)' Stock Item.");
    }
}

forceCreate();
