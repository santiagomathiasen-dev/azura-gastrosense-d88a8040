// Contrato de injeção — services que precisam de dados aceitam FetchFn
// em vez de importar supabaseFetch diretamente.
// Uso: new MyService(supabaseFetch)
export type FetchFn = (
    path: string,
    options?: RequestInit & { timeoutMs?: number }
) => Promise<unknown>;

export * from './stock/types';
export * from './stock/services/StockService';
