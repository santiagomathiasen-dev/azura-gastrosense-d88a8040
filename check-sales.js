
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const client = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("--- Checking Recent Sales (Last 5) ---");
    const { data: sales, error: salesError } = await client
        .from('sales')
        .select('id, sale_date, quantity_sold, notes, created_at, sale_products(name)')
        .order('created_at', { ascending: false })
        .limit(5);

    if (salesError) console.error(salesError);
    else console.table(sales.map(s => ({
        Date: new Date(s.created_at).toLocaleString(),
        Product: s.sale_products?.name,
        Qty: s.quantity_sold,
        Notes: s.notes
    })));

    console.log("\n--- Checking Recent Stock Movements (Last 5) ---");
    const { data: movements, error: movError } = await client
        .from('stock_movements')
        .select('id, type, quantity, notes, created_at, stock_items(name)')
        .order('created_at', { ascending: false })
        .limit(5);

    if (movError) console.error(movError);
    else console.table(movements.map(m => ({
        Date: new Date(m.created_at).toLocaleString(),
        Item: m.stock_items?.name,
        Type: m.type,
        Qty: m.quantity,
        Notes: m.notes
    })));
}

main();
