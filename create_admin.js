import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function createAdmin() {
    const envFile = fs.readFileSync('.env', 'utf-8');
    let url = '';
    let key = '';
    envFile.split('\n').forEach(line => {
        if (line.includes('VITE_SUPABASE_URL')) url = line.split('=')[1].replace(/"/g, '').trim();
        if (line.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) key = line.split('=')[1].replace(/"/g, '').trim();
    });

    const supabase = createClient(url, key);

    console.log("Tentando logar admin...");
    const adminEmail = 'admin@azura.local'; // Or whatever email they want
    const adminPassword = 'adminPassword123';

    let { data, error } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
            data: {
                role: 'owner',
                name: 'Administrador Azura'
            }
        }
    });

    if (error) {
        console.error("Erro no cadastro:", error.message);
        if (error.message.includes("User already registered")) {
            console.log("O usuário já existe! Vamos logar...");
            const loginRes = await supabase.auth.signInWithPassword({
                email: adminEmail,
                password: adminPassword
            });
            console.log("Login:", loginRes.error ? loginRes.error.message : "Sucesso. Sessão ativa.");
        }
    } else {
        console.log("Usuário criado. IDs:", data.user?.id);
    }
}

createAdmin().catch(console.error);
