import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function run() {
    console.log('Invoking extract-ingredients with tiny base64 image...');

    // 1x1 transparent png base64
    const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    try {
        const { data, error } = await supabase.functions.invoke('extract-ingredients', {
            body: {
                fileType: 'image',
                content: b64,
                mimeType: 'image/png',
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
