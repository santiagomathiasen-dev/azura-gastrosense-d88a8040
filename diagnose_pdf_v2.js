import fs from 'fs';

async function testExtraction() {
    const filePath = 'd:/azura-gastrosense/ingredientes.pdf';
    const fileData = fs.readFileSync(filePath);
    const base64Content = fileData.toString('base64');

    const key = 'AIzaSyDIi8gL-7oSZi5-NZ6IdHzblY7jhf14n7Y';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;

    const systemPrompt = `Você é um assistente especializado em gestão de estoque e culinária profissional.
Sua tarefa é extrair itens, produtos ou ingredientes de documentos (PDFs, fotos, textos).

REGRAS CRÍTICAS:
1. Analise INTEGRALMENTE o documento, percorrendo todas as páginas e colunas.
2. Identifique nomes de produtos, quantidades, unidades de medida e preços.
3. Se for uma Nota Fiscal (NF), extraia os itens listados.
4. Categorias válidas: laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros.
5. Unidades permitidas: kg, g, L, ml, unidade, caixa, dz.
6. Retorne SEMPRE um JSON válido.
7. No campo "summary", descreva brevemente o que encontrou ou por que não conseguiu extrair (se for o caso).`;

    const userPrompt = `Extraia todos os itens encontrados no documento para este JSON:
{
  "ingredients": [{"name": string, "quantity": number, "unit": string, "category": string, "price": number, "supplier": string, "minimum_quantity": number}],
  "summary": "resumo do que foi lido"
}`;

    const body = {
        system_instruction: {
            parts: [{ text: systemPrompt }]
        },
        contents: [
            {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: base64Content,
                        },
                    },
                    { text: userPrompt }
                ],
            },
        ],
        generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
        },
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const aiResponse = await res.json();
        const assistantMessage = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";

        console.log("Raw response preview:", assistantMessage.slice(0, 150));

        let result = { ingredients: [], summary: "" };

        try {
            let cleaned = assistantMessage.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
            }
            const parsed = JSON.parse(cleaned);
            result = {
                ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : (Array.isArray(parsed) ? parsed : []),
                summary: parsed.summary || "",
            };
        } catch (e) {
            console.error("Parse failure:", e);
        }

        // Normalization logic from Edge Function
        const validUnits = ["kg", "g", "L", "ml", "unidade", "caixa", "dz"];
        const validCategories = ["laticinios", "secos_e_graos", "hortifruti", "carnes_e_peixes", "embalagens", "limpeza", "outros"];

        const toNumber = (v) => {
            if (typeof v === 'number') return v;
            if (!v) return 0;
            const n = parseFloat(String(v).replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };

        const finalIngredients = (result.ingredients || [])
            .map((ing) => {
                const name = String(ing.nome ?? ing.name ?? ing.item ?? ing.descricao ?? ing.produto ?? "").trim();
                if (!name) return null;

                let unitRaw = String(ing.unidade ?? ing.unit ?? ing.un ?? "unidade").toLowerCase().trim();
                if (unitRaw === "l") unitRaw = "L";

                return {
                    name,
                    quantity: toNumber(ing.quantidade ?? ing.quantity ?? ing.qtd ?? 1),
                    unit: validUnits.includes(unitRaw) ? unitRaw : "unidade",
                    category: validCategories.includes(String(ing.categoria ?? ing.category).toLowerCase().trim()) ? String(ing.categoria ?? ing.category).toLowerCase().trim() : "outros",
                    price: ing.price ?? ing.preco ?? ing.valor ?? null,
                };
            })
            .filter(Boolean);

        console.log('\n--- Final Normalized Results ---');
        console.log('Total Ingredients Extracted:', finalIngredients.length);
        console.log('Summary:', result.summary);
        if (finalIngredients.length > 0) {
            console.log('First Item:', finalIngredients[0]);
        }
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

testExtraction();
