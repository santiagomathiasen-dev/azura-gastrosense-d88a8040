
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

async function checkStock() {
    console.log("--- Checking Stock & Components ---");

    // 1. Check Stock Item
    const { data: stockItems, error: stockError } = await supabase
        .from('stock_items')
        .select('*')
        .ilike('name', '%Croissant%');

    if (stockError) console.error("Stock Error:", stockError.message);

    if (!stockItems || stockItems.length === 0) {
        console.log("❌ NO Stock Item found with name like 'Croissant'");
    } else {
        console.log("✅ Stock Items found:");
        stockItems.forEach(i => console.log(`   - [${i.id}] ${i.name} (Qty: ${i.current_quantity} ${i.unit})`));
    }

    // 2. Check Sale Product
    const { data: saleProducts, error: saleError } = await supabase
        .from('sale_products')
        .select('*')
        .ilike('name', 'Croissant');

    if (saleError) console.error("Sale Product Error:", saleError.message);

    if (!saleProducts || saleProducts.length === 0) {
        console.log("❌ NO Sale Product found with name 'Croissant'");
    } else {
        console.log("✅ Sale Product found:");
        saleProducts.forEach(p => {
            console.log(`   - [${p.id}] ${p.name}`);
            checkComponents(p.id);
        });
    }
}

async function checkComponents(saleProductId) {
    const { data: components, error } = await supabase
        .from('sale_product_components')
        .select('*, stock_item:stock_items(name)')
        .eq('sale_product_id', saleProductId);

    if (error) {
        console.error("   ❌ Error checking components:", error.message);
        return;
    }

    if (!components || components.length === 0) {
        console.log(`   ⚠️ This product has NO components linked.`);
    } else {
        console.log(`   🔗 Components:`);
        components.forEach(c => {
            const name = c.stock_item?.name || c.component_id;
            console.log(`      - Type: ${c.component_type} | Item: ${name} | Qty: ${c.quantity}`);
        });
    }
}

checkStock();
