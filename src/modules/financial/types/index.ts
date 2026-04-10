import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — Contrato entre Estoque e Financeiro
// FinancialService usa este tipo para registrar despesas sem que o hook de
// Estoque conheça a estrutura interna de financial_expenses.
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceExpenseRequest {
    /** ID do dono (owner/gestor) para RLS */
    ownerId: string;
    /** Nome do fornecedor */
    supplierName: string;
    /** Número da nota fiscal */
    invoiceNumber: string;
    /** Valor total da nota */
    totalValue: number;
    /** Data de emissão (ISO string) */
    emissionDate: string;
}

export const FinancialExpenseCategorySchema = z.enum([
    'fixed',
    'variable',
    'investment',
]);

export const FinancialExpenseStatusSchema = z.enum([
    'pending',
    'paid',
    'overdue',
    'cancelled',
]);

export const FinancialExpenseSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    description: z.string(),
    amount: z.number().positive(),
    category: FinancialExpenseCategorySchema,
    type: z.string().nullable().optional(),
    date: z.string(),
    status: FinancialExpenseStatusSchema,
    invoice_number: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export type FinancialExpenseCategory = z.infer<typeof FinancialExpenseCategorySchema>;
export type FinancialExpenseStatus = z.infer<typeof FinancialExpenseStatusSchema>;
export type FinancialExpense = z.infer<typeof FinancialExpenseSchema>;
