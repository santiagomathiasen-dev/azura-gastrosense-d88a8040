
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

async function linkStock() {
    console.log("--- Linking Existing Stock (Retry) ---");

    // 1. Find Stock Item by Name (Loose Search)
    const { data: stockItems, error: stockError } = await supabase
        .from('stock_items')
        .select('id, name')
        .ilike('name', '%Croissant%'); // Just look for Croissant

    if (stockError) console.error(stockError.message);

    if (!stockItems || stockItems.length === 0) {
        console.error(`❌ Stock Item with 'Croissant' NOT FOUND.`);
        return;
    }

    // Pick the best match
    const stockItem = stockItems.find(i => i.name.includes('(Estoque)')) || stockItems[0];
    console.log(`✅ Found Stock Item: ${stockItem.name} (${stockItem.id})`);

    // 2. Find Sale Product by Name
    const { data: products, error: prodError } = await supabase
        .from('sale_products')
        .select('id, name')
        .ilike('name', '%Croissant%');

    if (prodError || !products || products.length === 0) {
        console.error("❌ Sale Product 'Croissant' NOT FOUND.");
        return;
    }

    const saleProduct = products[0];
    console.log(`✅ Found Sale Product: ${saleProduct.name} (${saleProduct.id})`);

    // 3. Create Link
    await supabase.from('sale_product_components').delete().eq('sale_product_id', saleProduct.id);

    const { error: linkError } = await supabase
        .from('sale_product_components')
        .insert({
            sale_product_id: saleProduct.id,
            component_type: 'stock_item',
            component_id: stockItem.id,
            quantity: 1,
            unit: 'unidade'
        });

    if (linkError) {
        console.error("❌ Failed to link:", linkError.message);
    } else {
        console.log("✅ SUCCESSFULLY Linked!");
    }
}

linkStock();
