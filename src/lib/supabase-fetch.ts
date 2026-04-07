
/**
 * Utilitário para realizar chamadas diretas à API do Supabase ignorando o SDK quando necessário.
 * Resolve problemas de travamento (hang) em PWAs e instabilidades de cache.
 */
export async function supabaseFetch(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        console.error("Supabase Fetch: Missing env variables for Supabase");
        throw new Error("Supabase URL or Key missing");
    }

    // Garante que a URL base não tenha barra no final para evitar URLS//rest...
    const baseUrl = supabaseUrl.replace(/\/$/, "");

    let url: string;
    if (path.startsWith('http')) {
        url = path;
    } else if (path.startsWith('functions/v1/')) {
        url = `${baseUrl}/${path}`;
    } else if (path.startsWith('rpc/')) {
        url = `${baseUrl}/rest/v1/${path}`;
    } else {
        url = `${baseUrl}/rest/v1/${path.replace(/^\//, '')}`;
    }

    const headers = new Headers(options.headers);
    headers.set('apikey', supabaseKey);

    // Set default Content-Type for requests with body if not already set
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (!headers.has('Authorization')) {
        try {
            const { supabase } = await import('@/integrations/supabase/client');

            // Step 1: Try getSession() quickly from local storage (should be near-instant)
            let token: string | null = null;
            const sessionResult = await Promise.race([
                supabase.auth.getSession(),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
            ]);

            if (sessionResult && (sessionResult as any).data?.session?.access_token) {
                token = (sessionResult as any).data.session.access_token;
            } else {
                // Session not in storage or timed out — try refreshing with a longer window
                try {
                    const refreshResult = await Promise.race([
                        supabase.auth.refreshSession(),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
                    ]);
                    if (refreshResult && (refreshResult as any).data?.session?.access_token) {
                        token = (refreshResult as any).data.session.access_token;
                    }
                } catch (_) {
                    // refresh failed silently
                }
            }

            if (token) {
                headers.set('Authorization', `Bearer ${token}`);
            } else {
                const method = (options.method || 'GET').toUpperCase();
                if (method !== 'GET') {
                    throw new Error('Sessão expirada. Faça login novamente.');
                }
                // GET sem auth usa apenas apikey (anon access via RLS)
            }
        } catch (e: any) {
            if (e?.message?.includes('Sessão expirada')) throw e;
            console.warn("Supabase Fetch: Could not extract auth token", e);
        }
    }

    // Abort controller: use caller's signal if provided, else create one with timeout
    const { timeoutMs = 60_000, signal: callerSignal, ...fetchOptions } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

    // If caller passed a signal, abort ours when theirs fires
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener('abort', onCallerAbort);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            headers,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Supabase Fetch Error [${response.status}] [${url}]:`, errorText);

            let friendlyMessage: string;
            switch (response.status) {
                case 400: friendlyMessage = `Requisição inválida: ${errorText || 'verifique os dados enviados'}`; break;
                case 401: friendlyMessage = 'Sessão expirada. Faça login novamente.'; break;
                case 403: friendlyMessage = 'Sem permissão para realizar esta operação.'; break;
                case 404: friendlyMessage = 'Recurso não encontrado.'; break;
                case 409: friendlyMessage = `Conflito de dados: ${errorText || 'registro já existe'}`; break;
                case 422: friendlyMessage = `Dados inválidos: ${errorText || 'verifique os campos obrigatórios'}`; break;
                case 500: case 502: case 503: friendlyMessage = 'Servidor indisponível. Tente novamente em instantes.'; break;
                default:  friendlyMessage = errorText || `Erro na conexão (${response.status})`;
            }

            const error = new Error(friendlyMessage);
            (error as any).status = response.status;
            (error as any).url = url;
            (error as any).raw = errorText;
            throw error;
        }

        // Caso de 204 No Content ou corpo vazio
        const text = await response.text();
        if (!text || text.trim() === "") return null;

        try {
            return JSON.parse(text);
        } catch (e) {
            // Se não for JSON, retorna o texto puro (casos raros)
            return text;
        }
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.message === 'timeout') {
            const timeoutErr = new Error(`Conexão expirou após ${timeoutMs / 1000}s. Verifique sua internet e tente novamente.`);
            (timeoutErr as any).cause = error;
            (timeoutErr as any).url = url;
            throw timeoutErr;
        }
        // Already enriched errors (status set above) — re-throw directly
        if (error?.status) throw error;
        console.error("Supabase Fetch error:", error);
        throw error;
    } finally {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', onCallerAbort);
    }
}
