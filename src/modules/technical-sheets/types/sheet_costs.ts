import { z } from 'zod';

// =============================================================================
// FASE 3 — Tipos para a tabela sheet_costs
//
// Esta tabela contém os campos financeiros extraídos de technical_sheets.
// O frontend NUNCA escreve custos diretamente em technical_sheets — passa
// sempre por SheetCostsService.
// =============================================================================

export const SheetCostsSchema = z.object({
    id:                  z.string().uuid(),
    technical_sheet_id:  z.string().uuid(),
    user_id:             z.string().uuid(),
    labor_cost:          z.number().min(0).default(0),
    energy_cost:         z.number().min(0).default(0),
    other_costs:         z.number().min(0).default(0),
    markup:              z.number().min(0).default(0),
    target_price:        z.number().min(0).nullable().optional(),
    total_cost:          z.number().min(0).nullable().optional(),
    cost_per_unit:       z.number().min(0).nullable().optional(),
    created_at:          z.string().optional(),
    updated_at:          z.string().optional(),
});

export const SheetCostsInsertSchema = SheetCostsSchema.omit({ id: true, created_at: true, updated_at: true });
export const SheetCostsUpdateSchema = SheetCostsInsertSchema.partial().omit({ technical_sheet_id: true, user_id: true });

export type SheetCosts         = z.infer<typeof SheetCostsSchema>;
export type SheetCostsInsert   = z.infer<typeof SheetCostsInsertSchema>;
export type SheetCostsUpdate   = z.infer<typeof SheetCostsUpdateSchema>;

/** Versão calculada: total_cost derivado dos componentes */
export interface SheetCostsComputed extends SheetCosts {
    ingredient_cost: number;       // vem dos ingredientes — calculado no hook
    computed_total:  number;       // labor + energy + other + ingredient
    computed_price:  number | null; // computed_total * (1 + markup/100)
}
