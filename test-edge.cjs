// test-edge.cjs
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://lqktevnjfywrujdhetlo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMzMDYsImV4cCI6MjA4NjY2OTMwNn0.scbJAuB0IOZTii6MgTeKL9luTaa96GqugWfIaCSk8eo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    console.log('Sending request to edge function...');
    const { data, error } = await supabase.functions.invoke('extract-ingredients', {
        body: {
            fileType: 'text',
            content: '1 litro de leite de vaca',
            mimeType: 'text/plain',
            extractRecipe: false
        }
    });

    console.log('Error:', error);
    console.log('Data:', data);
}

test();
