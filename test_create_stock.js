import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
    const { data: authData, error: authE } = await supabase.auth.signInWithPassword({ email: 'admin@admin.com', password: 'password' });
    if (authE) {
        console.log('Auth Error:', authE.message);
        return;
    }
    console.log('Auth OK:', authData.user.id);

    const { data, error } = await supabase.from('stock_items').insert({
        name: 'Teste Manual',
        current_quantity: 1,
        unit: 'kg',
        category: 'outros',
        minimum_quantity: 0,
        user_id: authData.user.id
    }).select();

    if (error) {
        console.log('Insert Error:', error);
    } else {
        console.log('Insert OK:', data);
    }
}
run();
