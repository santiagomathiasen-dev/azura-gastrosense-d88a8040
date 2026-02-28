// test-edge-image.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = "https://lqktevnjfywrujdhetlo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMzMDYsImV4cCI6MjA4NjY2OTMwNn0.scbJAuB0IOZTii6MgTeKL9luTaa96GqugWfIaCSk8eo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    console.log('Reading image...');
    // Read the image artifact
    const imageBuf = fs.readFileSync("C:\\Users\\Brenda Santi Mike\\.gemini\\antigravity\\brain\\1f02a0af-7a7d-43b8-a417-25e7a4981df8\\media__1772305401332.jpg");
    const base64Image = imageBuf.toString('base64');

    console.log(`Image size: ${(base64Image.length / 1024).toFixed(2)} KB`);
    console.log('Sending request to edge function...');

    const startTime = Date.now();

    try {
        const { data, error } = await supabase.functions.invoke('extract-ingredients', {
            body: {
                fileType: 'image',
                content: base64Image,
                mimeType: 'image/jpeg',
                extractRecipe: false
            }
        });

        const elapsed = Date.now() - startTime;
        console.log(`Time elapsed: ${elapsed} ms`);

        if (error) {
            console.log('Supabase Error:', error);
        }

        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Execution error:", err);
    }
}

test();
