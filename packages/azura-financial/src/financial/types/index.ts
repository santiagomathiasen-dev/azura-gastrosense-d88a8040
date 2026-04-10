import { z } from 'zod';

export const SalePeriodSchema = z.enum(['day', 'week', 'month', 'custom']);

export const SaleSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    product_id: z.string().uuid().nullable().optional(),
    quantity: z.number().positive(),
    unit_price: z.number().min(0),
    total_price: z.number().min(0),
    sale_date: z.string(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
});

export type SalePeriod = z.infer<typeof SalePeriodSchema>;
export type Sale = z.infer<typeof SaleSchema>;

/** Resultado agregado de histórico de produção por ficha técnica */
export interface ProductionHistoryItem {
    technicalSheetId: string;
    technicalSheetName: string;
    yieldUnit: string;
    totalSales: number;
    productionUsed: number;
    currentStock: number;
    toProduce: number;
}

/** Resumo financeiro de um período */
export interface FinancialSummary {
    totalRevenue: number;
    totalCost: number;
    grossMargin: number;
    grossMarginPct: number;
    periodStart: string;
    periodEnd: string;
}
