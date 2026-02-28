const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://lqktevnjfywrujdhetlo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5MzMwNiwiZXhwIjoyMDg2NjY5MzA2fQ.tevtSheI13dCAzxnl9YXTVZKETGfRN_Rmfe3MER_vVk";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importIngredients() {
    try {
        console.log('Fetching user santiago.aloom@gmail.com...');
        // We will find the user to attribute the stock_items to
        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

        if (usersError) throw usersError;

        const santiagoUser = users.find(u => u.email === 'santiago.aloom@gmail.com');

        if (!santiagoUser) {
            throw new Error("User santiago.aloom@gmail.com not found");
        }

        const userId = santiagoUser.id;
        console.log(`User found: ${userId}`);

        const items = [
            { name: "Farinha de Trigo", category: "secos_e_graos", unit: "kg" },
            { name: "Manteiga", category: "laticinios", unit: "kg" },
            { name: "Mel", category: "outros", unit: "L" },
            { name: "Açúcar Mascavo", category: "secos_e_graos", unit: "kg" },
            { name: "Açúcar Comum", category: "secos_e_graos", unit: "kg" },
            { name: "Ovo", category: "laticinios", unit: "unidade" },
            { name: "Noz Moscada", category: "secos_e_graos", unit: "g" },
            { name: "Gengibre", category: "hortifruti", unit: "kg" },
            { name: "Canela em pó", category: "secos_e_graos", unit: "g" },
            { name: "Açúcar de Confeiteiro", category: "secos_e_graos", unit: "kg" },
            { name: "Limão", category: "hortifruti", unit: "kg" }
        ];

        const inserts = items.map(item => ({
            ...item,
            user_id: userId,
            current_quantity: 0,
            minimum_quantity: 0
        }));

        console.log('Inserting items...');
        const { data, error } = await supabase
            .from('stock_items')
            .upsert(
                inserts,
                { onConflict: 'name, user_id', ignoreDuplicates: true } // Assuming no unique constraint or ignoring properly
            )
            .select();

        if (error) {
            // Since there could be no unique constraint on name, Let's just do insert normally, but we only create if they don't exist
            console.log('Upsert might have failed, falling back to read then insert...');

            const { data: existing } = await supabase.from('stock_items').select('name').eq('user_id', userId);
            const existingNames = new Set(existing?.map(e => e.name) || []);

            const newItems = inserts.filter(i => !existingNames.has(i.name));
            if (newItems.length > 0) {
                const { error: insErr } = await supabase.from('stock_items').insert(newItems);
                if (insErr) throw insErr;
                console.log(`Inserted ${newItems.length} new items.`);
            } else {
                console.log("All items already exist!");
            }
        } else {
            console.log('Upsert executed successfully.', data?.length);
        }

        console.log('Done!');
    } catch (e) {
        console.error("Error:", e);
    }
}

importIngredients();
