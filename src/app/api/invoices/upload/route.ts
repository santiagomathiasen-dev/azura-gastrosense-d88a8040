import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // 2. Chave de API Blindada
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERRO CRÍTICO: GEMINI_API_KEY ausente.');
      return NextResponse.json({ error: 'Configuração da IA ausente no servidor.' }, { status: 502 });
    }

    // 3. Parsing do Arquivo (Blindado contra limites e tipos)
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

    // Limite preventivo de 10MB (Vercel pode barrar antes em 4.5MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB).' }, { status: 413 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 4. Inicialização da IA Única (Arquitetura Universal de Visão)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { 
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });

    // Prompt Universal e Visionário
    const prompt = extractRecipe ? PROMPT_RECIPE : PROMPT_INGREDIENT;

    // 5. Execução com Diagnóstico de Veracidade
    let result;
    try {
      result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } }
      ]);
    } catch (aiErr: any) {
      console.error('FALHA NA API DO GOOGLE:', aiErr);
      return NextResponse.json({ 
        error: 'Falha na IA: ' + (aiErr.message?.includes('Quota') ? 'Limite de uso excedido' : aiErr.message),
        details: aiErr.stack
      }, { status: 502 });
    }

    const rawText = result.response.text();
    if (!rawText) {
      return NextResponse.json({ error: 'A IA não conseguiu ler o documento (resposta vazia).' }, { status: 422 });
    }

    // 6. Parsing de JSON Blindado
    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (pj: any) {
      // Tentativa de recuperação de JSON quebrado
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {
          return NextResponse.json({ error: 'IA retornou formato inválido.', raw: rawText }, { status: 422 });
        }
      } else {
        return NextResponse.json({ error: 'IA falhou ao estruturar dados.', raw: rawText }, { status: 422 });
      }
    }

    // 7. Normalização Universal de Dados
    const rawIngredients: any[] = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const ingredients = rawIngredients
      .map((ing: any) => ({
        name: String(ing.nome ?? ing.name ?? '').trim(),
        quantity: typeof ing.quantidade === 'number' ? ing.quantidade : parseFloat(String(ing.quantidade ?? 1).replace(',', '.')) || 1,
        unit: String(ing.unidade ?? ing.unit ?? 'unidade').toLowerCase().trim(),
        price: ing.preco_unitario ?? ing.price ?? null,
        price_total: ing.preco_total ?? null,
        category: ing.categoria ?? ing.category ?? 'outros',
        supplier: parsed.fornecedor ?? null,
      }))
      .filter((i: any) => i.name);

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

    // 8. Persistência de Dados (Opcional)
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
      }
    }

    // 9. Retorno Final Sucesso
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('ERRO NÃO TRATADO NO UPLOAD:', error);
    return NextResponse.json({ 
      error: 'Erro sistêmico: ' + (error.message || 'Desconhecido'),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 400 }); // Retorna 400 em vez de 500 para evitar crash do listener
  }
}
