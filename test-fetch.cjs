// test-fetch.cjs
const fs = require('fs');

const SUPABASE_URL = "https://lqktevnjfywrujdhetlo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMzMDYsImV4cCI6MjA4NjY2OTMwNn0.scbJAuB0IOZTii6MgTeKL9luTaa96GqugWfIaCSk8eo";

async function testFetch() {
    console.log('Reading image...');
    const imageBuf = fs.readFileSync("C:\\Users\\Brenda Santi Mike\\.gemini\\antigravity\\brain\\1f02a0af-7a7d-43b8-a417-25e7a4981df8\\media__1772305401332.jpg");
    const base64Image = imageBuf.toString('base64');

    const functionUrl = `${SUPABASE_URL}/functions/v1/extract-ingredients`;
    console.log('Sending request to', functionUrl);

    const startTime = Date.now();

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                fileType: 'image',
                content: base64Image,
                extractRecipe: false,
                mimeType: 'image/jpeg'
            })
        });

        const elapsed = Date.now() - startTime;
        console.log(`Time elapsed: ${elapsed} ms`);
        console.log(`HTTP Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            console.log('Error Body:', text);
            return;
        }

        const data = await response.json();
        console.log('Success Data:', JSON.stringify(data).substring(0, 500) + '...');
    } catch (err) {
        console.error("Execution error:", err);
    }
}

testFetch();
