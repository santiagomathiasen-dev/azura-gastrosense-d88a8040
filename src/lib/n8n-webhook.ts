const N8N_WEBHOOK_URL =
  'https://webhook.teste-azura.duckdns.org/webhook/aa5447df-0558-4d70-9287-554917e30782';

export interface N8nResult {
  ok: boolean;
  error?: string;
}

export async function sendToN8n(
  file: File,
  aba_origem: string,
  usuario_id?: string
): Promise<N8nResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      try {
        const res = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aba_origem,
            usuario_id: usuario_id ?? null,
            documento: base64,
            nomeArquivo: file.name,
            tipoArquivo: file.type,
            tamanhoBytes: file.size,
          }),
        });

        if (!res.ok) {
          resolve({ ok: false, error: `Servidor retornou erro ${res.status}` });
          return;
        }

        resolve({ ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro de conexão';
        resolve({ ok: false, error: msg });
      }
    };

    reader.onerror = () => resolve({ ok: false, error: 'Erro ao ler o arquivo' });
    reader.readAsDataURL(file);
  });
}
