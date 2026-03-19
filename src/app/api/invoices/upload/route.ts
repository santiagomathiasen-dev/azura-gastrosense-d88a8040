import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 60; // Vercel timeout adjustment

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // 1. Upload to Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('invoices')
      .upload(fileName, file);

    if (storageError) throw storageError;

    const fileUrl = storageData.path;

    // 2. Create record in invoice_imports (Status: pending)
    const { data: importRecord, error: importError } = await supabase
      .from('invoice_imports')
      .insert({
        user_id: user.id,
        status: 'pending',
        file_url: fileUrl,
      })
      .select()
      .single();

    if (importError) throw importError;

    // 3. Trigger Background Processing (Async)
    // We call our own internal API or use a background pattern
    // In Vercel, we can use waitUntil if available or just a fetch without await (less reliable)
    const processUrl = new URL('/api/invoices/process', req.url).toString();
    
    // Non-blocking trigger
    fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importId: importRecord.id }),
    }).catch(err => console.error('Background trigger error:', err));

    return NextResponse.json({ 
      success: true, 
      importId: importRecord.id,
      message: 'Upload concluído. Processamento iniciado em segundo plano.' 
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
