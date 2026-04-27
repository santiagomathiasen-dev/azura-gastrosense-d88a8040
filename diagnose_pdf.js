import fs from 'fs';

async function testExtraction() {
    const filePath = 'd:/azura-gastrosense/ingredientes.pdf';
    const fileData = fs.readFileSync(filePath);
    const base64Content = fileData.toString('base64');

    const key = 'AIzaSyDIi8gL-7oSZi5-NZ6IdHzblY7jhf14n7Y';
    // Use v1beta as in the function
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

    console.log('Sending request to Gemini...');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log('Status:', res.status);
        if (res.status !== 200) {
            console.log('Error:', JSON.stringify(data, null, 2));
            return;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('Raw Response (first 1000 chars):');
        console.log(text?.slice(0, 1000));

        if (text) {
            try {
                const parsed = JSON.parse(text);
                console.log('\n--- Extraction Results ---');
                console.log('Summary:', parsed.summary);
                console.log('Total Ingredients Extracted:', parsed.ingredients?.length);
                if (parsed.ingredients?.length > 0) {
                    console.log('First 5 items:', JSON.stringify(parsed.ingredients.slice(0, 5), null, 2));
                }
            } catch (e) {
                console.log('Failed to parse JSON response');
            }
        }
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

testExtraction();
