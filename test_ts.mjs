const URL = "https://lqktevnjfywrujdhetlo.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMzMDYsImV4cCI6MjA4NjY2OTMwNn0.scbJAuB0IOZTii6MgTeKL9luTaa96GqugWfIaCSk8eo";

async function run() {
    const authRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@admin.com', password: 'password' })
    });
    const authMsg = await authRes.json();
    if (authMsg.error) {
        console.log("Auth Error:", authMsg.error_description);
        return;
    }
    const token = authMsg.access_token;
    const userId = authMsg.user.id;

    // Attempt to insert technical sheet
    const insertRes = await fetch(`${URL}/rest/v1/technical_sheets`, {
        method: 'POST',
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            user_id: userId,
            name: 'Teste Manual Script',
            labor_cost: 0,
            energy_cost: 0,
            other_costs: 0,
            markup: 1
        })
    });
    console.log("Insert Status:", insertRes.status, insertRes.statusText);
    console.log("Insert Response:", await insertRes.text());
}
run();
