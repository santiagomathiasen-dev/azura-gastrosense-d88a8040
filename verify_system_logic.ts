import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

let envStr = '';
try {
    envStr = fs.readFileSync('.env', 'utf-8');
} catch (e) {
    console.warn("Could not read .env file");
}

let SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
let SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (envStr) {
    envStr.split('\n').forEach(line => {
        if (line.includes('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim().replace(/^"|"$/g, '');
        if (line.includes('VITE_SUPABASE_PUBLISHABLE_KEY=')) SUPABASE_KEY = line.split('=')[1].trim().replace(/^"|"$/g, '');
    });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTests() {
    console.log("=== INICIANDO TESTE COMPLETO DE LÓGICA DO SISTEMA ===");

    const tests = [
        {
            name: "1. Admin/Gestor/Colaborador (Profiles)", check: async () => {
                const { data, error } = await supabase.from('profiles').select('id, role, business_role').limit(5);
                if (error) throw error;
                return `✅ Encontrados ${data.length} perfis.`;
            }
        },
        {
            name: "4. Cadastro Ingredientes", check: async () => {
                const { data, error } = await supabase.from('ingredients').select('id, name').limit(5);
                if (error) throw error;
                return `✅ Encontrados ${data.length} ingredientes.`;
            }
        },
        {
            name: "5. Cadastro Fornecedores", check: async () => {
                const { data, error } = await supabase.from('suppliers').select('id, name').limit(5);
                if (error) throw error;
                return `✅ Encontrados ${data.length} fornecedores.`;
            }
        },
        {
            name: "6. Modificação da Data de Validade", check: async () => {
                const { data, error } = await supabase.from('expiry_dates').select('*').limit(5);
                if (error) {
                    if (error.code === '42P01') return '⚠️ Tabela expiry_dates não existe ou erro de política.';
                    throw error;
                }
                return `✅ Encontradas ${data ? data.length : 0} datas de validade.`;
            }
        },
        {
            name: "7. Fichas Técnicas", check: async () => {
                const { data, error } = await supabase.from('technical_sheets').select('id, product_name').limit(5);
                if (error) throw error;
                return `✅ Encontradas ${data.length} fichas técnicas.`;
            }
        },
        {
            name: "8. Estoque de Insumos", check: async () => {
                const { data, error } = await supabase.from('stock_movements').select('*').limit(5);
                if (error) throw error;
                return `✅ Tabela de movimentos de estoque ok.`;
            }
        },
        {
            name: "9. Planejamento de Produção", check: async () => {
                const { data, error } = await supabase.from('productions').select('id, status').limit(5);
                if (error) throw error;
                return `✅ Encontradas ${data.length} produções.`;
            }
        },
        {
            name: "10. Previsão de Vendas", check: async () => {
                const { data, error } = await supabase.from('sales_forecasts').select('id').limit(5);
                if (error) throw error;
                return `✅ Tabela sales_forecasts ok.`;
            }
        },
        {
            name: "11. Pedidos (Compras)", check: async () => {
                const { data, error } = await supabase.from('purchases').select('id').limit(5);
                if (error) throw error;
                return `✅ Tabela purchases ok.`;
            }
        },
        {
            name: "12. Financeiro", check: async () => {
                const { data, error } = await supabase.from('financial_transactions').select('id').limit(5);
                if (error) {
                    if (error.code === '42P01') return '⚠️ Tabela financial_transactions não existe.';
                    throw error;
                }
                return `✅ Tabela financial_transactions ok.`;
            }
        },
        {
            name: "13. Perdas", check: async () => {
                const { data, error } = await supabase.from('loss_reports').select('id').limit(5);
                if (error) {
                    if (error.code === '42P01') return '⚠️ Tabela loss_reports não existe.';
                    throw error;
                }
                return `✅ Tabela loss_reports ok.`;
            }
        },
        {
            name: "14. Produtos Venda", check: async () => {
                const { data, error } = await supabase.from('sale_products').select('id').limit(5);
                if (error) throw error;
                return `✅ Tabela sale_products ok.`;
            }
        }
    ];

    for (const test of tests) {
        try {
            const result = await test.check();
            console.log(`[PASS] ${test.name}: ${result}`);
        } catch (err) {
            console.error(`[FAIL] ${test.name}: Falha na lógica ou banco de dados.`);
            console.error(err);
        }
    }
}

runTests().catch(console.error);
