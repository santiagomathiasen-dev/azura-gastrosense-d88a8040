import type { VercelRequest, VercelResponse } from "@vercel/node";

const VALID_UNITS = ["kg", "g", "l", "ml", "unidade", "caixa", "dz"];
const VALID_CATEGORIES = [
  "laticinios",
  "secos_e_graos",
  "hortifruti",
  "carnes_e_peixes",
  "embalagens",
  "limpeza",
  "outros",
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Conteúdo ausente" });
    }

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Retorne SOMENTE JSON válido. Sempre um array. Nunca markdown.",
            },
            { role: "user", content },
          ],
        }),
      }
    );

    const data = await openaiRes.json();
    let text = data.choices?.[0]?.message?.content || "";

    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res
        .status(400)
        .json({ error: "JSON inválido retornado pela IA", raw: text });
    }

    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: "IA não retornou array" });
    }

    const ingredients = parsed
      .map((i: any) => {
        const name = String(i.name || "").trim();
        if (!name) return null;

        const unit = String(i.unit || "").toLowerCase();
        const category = String(i.category || "").toLowerCase();

        return {
          name,
          quantity: Number(i.quantity) || 0,
          unit: VALID_UNITS.includes(unit) ? unit : "unidade",
          category: VALID_CATEGORIES.includes(category)
            ? category
            : "outros",
          price: i.price ?? null,
          supplier: i.supplier ?? null,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      count: ingredients.length,
      ingredients,
    });
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

