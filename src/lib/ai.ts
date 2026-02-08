// src/lib/utils.ts

export async function extractIngredientsAI(content: string) {
  const res = await fetch("/api/extract-ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error("Erro ao processar IA");
  }

  return res.json();
}

