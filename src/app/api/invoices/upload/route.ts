import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';

export const maxDuration = 90;

const PROMPT_INGREDIENT = `Você é um extrator de dados de notas fiscais e listas de compras.
Leia o documento e extraia TODOS os itens. Preserve nomes e unidades originais.
Categorias permitidas: laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros.

Retorne SOMENTE este JSON (nenhum texto fora do JSON):
{
  "fornecedor": "nome do fornecedor ou null",
  "numero_nota": "número da nota ou null",
  "data_emissao": "YYYY-MM-DD ou null",
  "valor_total": 0.00,
  "ingredients": [
    {
      "nome": "nome exato do produto",
      "quantidade": 1.0,
      "unidade": "unidade exata",
      "preco_unitario": 0.00,
      "preco_total": 0.00,
      "categoria": "categoria aqui"
    }
  ],
  "summary": "resumo em 1 frase"
}`;

const PROMPT_RECIPE = `Você é um extrator de fichas técnicas gastronômicas.
Leia o documento e extraia os dados da receita. Preserve nomes e unidades originais.

Retorne SOMENTE este JSON (nenhum texto fora do JSON):
{
  "recipeName": "nome da receita",
  "preparationMethod": "modo de preparo completo",
  "preparationTime": 0,
  "yieldQuantity": 0,
  "labor_cost": 0.00,
  "energy_cost": 0.00,
  "other_costs": 0.00,
  "markup": 0.00,
  "praca": "local ou null",
  "ingredients": [
    {
      "nome": "nome exato",
      "quantidade": 1.0,
      "unidade": "unidade exata",
      "preco_unitario": 0.00,
      "categoria": "categoria aqui"
    }
  ],
  "summary": "resumo em 1 frase"
}`;

export async function POST(req: NextRequest) {
  try {
    // 1. Verificação de Autenticação
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sessão expirada ou não autorizado.' }, { status: 401 });
    }

    // 2. Chave de API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('ERRO CRÍTICO: OPENAI_API_KEY ausente.');
      return NextResponse.json({ error: 'Configuração da IA ausente no servidor.' }, { status: 502 });
    }

    // 3. Parsing do Arquivo
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e: any) {
      return NextResponse.json({ error: 'Falha ao processar formulário: ' + e.message }, { status: 400 });
    }

    const file = formData.get('file') as File;
    const extractRecipe = formData.get('extractRecipe') === 'true';
    const saveToDb = formData.get('saveToDb') !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB).' }, { status: 413 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 4. OpenAI Chat Completions
    const openai = new OpenAI({ apiKey });
    const prompt = extractRecipe ? PROMPT_RECIPE : PROMPT_INGREDIENT;

    const contentParts: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: prompt },
    ];

    if (mimeType.startsWith('image/')) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'high' },
      });
    } else if (mimeType === 'application/pdf') {
      contentParts.push({
        type: 'file',
        file: { filename: file.name, file_data: `data:application/pdf;base64,${base64Data}` },
      } as any);
    } else {
      // Text files (XML, CSV, TXT)
      const textContent = Buffer.from(arrayBuffer).toString('utf-8');
      contentParts[0] = { type: 'text', text: `${prompt}\n\n--- CONTEÚDO DO ARQUIVO ---\n${textContent}` };
    }

    let result;
    try {
      result = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: contentParts }],
      });
    } catch (aiErr: any) {
      console.error('FALHA NA API OPENAI:', aiErr);
      return NextResponse.json({
        error: 'Falha na IA: ' + (aiErr.message?.includes('quota') ? 'Limite de uso excedido' : aiErr.message),
      }, { status: 502 });
    }

    const rawText = result.choices[0]?.message?.content;
    if (!rawText) {
      return NextResponse.json({ error: 'A IA não conseguiu ler o documento (resposta vazia).' }, { status: 422 });
    }

    // 6. Parsing de JSON
    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {
          return NextResponse.json({ error: 'IA retornou formato inválido.', raw: rawText }, { status: 422 });
        }
      } else {
        return NextResponse.json({ error: 'IA falhou ao estruturar dados.', raw: rawText }, { status: 422 });
      }
    }

    // 7. Normalização
    const rawIngredients: any[] = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    if (rawIngredients.length === 0 && !extractRecipe) {
      console.warn('invoices/upload: AI returned no ingredients', { summary: parsed.summary });
    }
    const VALID_CATEGORIES = new Set(['laticinios', 'secos_e_graos', 'hortifruti', 'carnes_e_peixes', 'embalagens', 'limpeza', 'outros']);
    const ingredients = rawIngredients
      .map((ing: any) => {
        const name = String(ing.nome ?? ing.name ?? '').trim();
        const rawQty = ing.quantidade ?? ing.quantity ?? 1;
        const quantity = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(',', '.')) || 1;
        const rawCat = String(ing.categoria ?? ing.category ?? 'outros').toLowerCase().trim();
        return {
          name,
          quantity,
          unit: String(ing.unidade ?? ing.unit ?? 'unidade').toLowerCase().trim(),
          price: typeof ing.preco_unitario === 'number' ? ing.preco_unitario : null,
          price_total: typeof ing.preco_total === 'number' ? ing.preco_total : null,
          category: VALID_CATEGORIES.has(rawCat) ? rawCat : 'outros',
          supplier: parsed.fornecedor ?? null,
        };
      })
      .filter((i: any) => i.name.length > 0);

    const responseData: any = {
      ingredients,
      summary: parsed.summary ?? `${ingredients.length} item(s) extraído(s).`,
      fornecedor: parsed.fornecedor ?? null,
      numero_nota: parsed.numero_nota ?? null,
      data_emissao: parsed.data_emissao ?? null,
      valor_total: parsed.valor_total ?? null,
      ...(extractRecipe && {
        recipeName: parsed.recipeName ?? null,
        preparationMethod: parsed.preparationMethod ?? null,
        preparationTime: parsed.preparationTime ?? 0,
        yieldQuantity: parsed.yieldQuantity ?? 0,
        labor_cost: parsed.labor_cost ?? 0,
        energy_cost: parsed.energy_cost ?? 0,
        other_costs: parsed.other_costs ?? 0,
        markup: parsed.markup ?? 0,
        praca: parsed.praca ?? null,
      }),
    };

    // 8. Persistência
    if (saveToDb && !extractRecipe) {
      try {
        const { data: importRecord, error: importError } = await supabase
          .from('invoice_imports')
          .insert({
            user_id: user.id,
            status: 'completed',
            supplier_name: responseData.fornecedor,
            invoice_number: responseData.numero_nota,
            emission_date: responseData.data_emissao,
            total_value: responseData.valor_total,
            items_count: ingredients.length,
            extracted_data: responseData,
          })
          .select('id')
          .single();

        if (importError) throw importError;
        responseData.importId = importRecord?.id ?? null;
      } catch (dbErr: any) {
        console.warn('Alerta: Dados extraídos mas não salvos no histórico:', dbErr.message);
        responseData.importSaved = false;
      }
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('ERRO NÃO TRATADO NO UPLOAD:', error);
    return NextResponse.json({
      error: 'Erro sistêmico: ' + (error.message || 'Desconhecido'),
    }, { status: 400 });
  }
}
