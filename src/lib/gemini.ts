import OpenAI from "openai";

// Kept at src/lib/gemini.ts to avoid breaking existing imports
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

const PROMPT = `Extração de NF-e (Brasil).
Retorne apenas JSON com esta estrutura exata:
{
  "invoiceNumber": "string ou null",
  "emissionDate": "YYYY-MM-DD ou null",
  "supplierName": "string ou null",
  "supplierCnpj": "string ou null",
  "totalValue": 0.00,
  "items": [
    {
      "name": "string",
      "quantity": 1.0,
      "unit": "kg|g|L|ml|unidade|caixa|dz",
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "category": "laticinios|carnes|hortifruti|secos_e_graos|embalagens|limpeza|bebidas|outros"
    }
  ]
}`;

export const extractInvoiceData = async (content: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: `${PROMPT}\n\nConteúdo:\n${content}` }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      },
      { signal: controller.signal }
    );

    const text = completion.choices[0].message.content ?? "";
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`OpenAI retornou resposta inválida: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
};
