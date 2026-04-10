// =============================================================================
// FASE 4 — Tipos públicos do módulo OPS para consumo externo
//
// Regra: módulos externos (Financial, Stock, PDV) só conhecem estes tipos.
// Nunca importam tipos internos de src/hooks/ops diretamente.
// =============================================================================

export interface FinishedStockItem {
    id: string;
    technical_sheet_id: string;
    quantity: number;
    unit: string;
    praca: string | null;
    notes: string | null;
    /** Nome da ficha técnica (join opcional) */
    technical_sheet?: { name: string } | null;
}

export interface ProductionStockItem {
    id: string;
    stock_item_id: string;
    quantity: number;
    /** Nome do item de estoque (join opcional) */
    stock_item?: { name: string } | null;
}

export interface OpsSheetSummary {
    id: string;
    name: string;
    yield_quantity: number;
    yield_unit: string;
    production_type: 'insumo' | 'final';
    cost_per_unit: number | null;
    total_cost: number | null;
}

/** Resultado de uma dedução de estoque OPS para venda */
export interface StockDeductionResult {
    success: boolean;
    deducted: number;
    remaining: number;
    /** Mensagem de aviso quando estoque parcial */
    warning?: string;
}
