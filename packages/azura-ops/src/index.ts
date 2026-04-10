// --- Fetch injection contract ---
// Services that need to fetch data must receive a FetchFn instead of importing
// supabaseFetch directly, keeping this package free of Next.js dependencies.
//
// Usage:
//   class MyService {
//     constructor(private fetch: FetchFn) {}
//     async getData() { return this.fetch('table?select=*'); }
//   }
//
// The hook/caller injects: new MyService(supabaseFetch)
export type FetchFn = (
    path: string,
    options?: RequestInit & { timeoutMs?: number }
) => Promise<unknown>;

// --- Production ---
export * from './production/types';
export * from './production/services/ProductionService';

// --- Technical Sheets ---
export * from './technical-sheets/types';
export * from './technical-sheets/services/TechnicalSheetService';
