const { spawn } = require('child_process');

const url = 'https://lqktevnjfywrujdhetlo.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxa3Rldm5qZnl3cnVqZGhldGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMzMDYsImV4cCI6MjA4NjY2OTMwNn0.scbJAuB0IOZTii6MgTeKL9luTaa96GqugWfIaCSk8eo';

const tasks = [
    ['NEXT_PUBLIC_SUPABASE_URL', 'production', url],
    ['NEXT_PUBLIC_SUPABASE_URL', 'preview', url],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'production', key],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'preview', key],
];

function runNext(idx) {
    if (idx >= tasks.length) {
        console.log('All env vars set successfully');
        return;
    }
    const [name, target, value] = tasks[idx];
    console.log(`Setting ${name} for ${target}...`);

    // Command: npx vercel env add <name> <target>
    const child = spawn('npx.cmd', ['vercel', 'env', 'add', name, target], { stdio: ['pipe', 'inherit', 'inherit'], shell: true });

    setTimeout(() => {
        // Send exactly the value string without new lines
        child.stdin.write(value, () => {
            // Close stdin to signal end of input
            child.stdin.end();
        });
    }, 1000); // 1s wait for vercel to start prompting

    child.on('close', (code) => {
        console.log(`Command closed with code ${code}`);
        runNext(idx + 1);
    });
}

runNext(0);
