// Contrato de injeção — services que precisam de dados aceitam FetchFn
// em vez de importar supabaseFetch diretamente.
// Uso: new MyService(supabaseFetch)
export type FetchFn = (
    path: string,
    options?: RequestInit & { timeoutMs?: number }
) => Promise<unknown>;

// --- Supplier ---
export * from './supplier/types';
export * from './supplier/services/SupplierService';

// --- Purchases ---
export * from './purchases/types';
export * from './purchases/services/PurchaseService';
