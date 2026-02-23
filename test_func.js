import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function run() {
    console.log('Invoking extract-ingredients...');
    try {
        const { data, error } = await supabase.functions.invoke('extract-ingredients', {
            body: {
                fileType: 'text',
                content: '3 kg de farinha de trigo marca X a R$ 15,00',
                mimeType: 'text/plain',
                extractRecipe: false
            }
        });
        console.log('DATA:', data);
        console.log('ERROR:', error);
    } catch (e) {
        console.log('EXCEPTION:', e);
    }
}

run();
