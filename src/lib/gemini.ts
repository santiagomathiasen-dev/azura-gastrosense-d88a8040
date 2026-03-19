import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const nfeSchema = {
  description: "Extracted data from a Brazilian NF-e invoice",
  type: SchemaType.OBJECT,
  properties: {
    invoiceNumber: { type: SchemaType.STRING },
    emissionDate: { type: SchemaType.STRING },
    supplierName: { type: SchemaType.STRING },
    supplierCnpj: { type: SchemaType.STRING },
    totalValue: { type: SchemaType.NUMBER },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
          unitPrice: { type: SchemaType.NUMBER },
          totalPrice: { type: SchemaType.NUMBER },
          category: { type: SchemaType.STRING }
        },
        required: ["name", "quantity", "unit", "unitPrice"]
      }
    }
  },
  required: ["invoiceNumber", "supplierName", "totalValue", "items"]
};

export const extractInvoiceData = async (content: string) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: nfeSchema as any,
    },
  });

  const prompt = `
    Extraia os dados da seguinte Nota Fiscal (NF-e). 
    Retorne APENAS o JSON estruturado conforme o esquema fornecido.
    Converta unidades para os padrões: kg, g, L, ml, unidade, caixa, dz.
    Classifique os itens em categorias como: laticinios, carnes, hortifruti, secos_e_graos, embalagens, limpeza, bebidas, outros.

    Conteúdo da Nota:
    ${content}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return JSON.parse(response.text());
};
