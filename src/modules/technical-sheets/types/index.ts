import { z } from 'zod';

export const TechnicalSheetIngredientSchema = z.object({
    id: z.string().uuid().optional(),
    technical_sheet_id: z.string().uuid().optional(),
    stock_item_id: z.string().uuid(),
    quantity: z.number().min(0, "A quantidade não pode ser negativa"),
    cost: z.number().min(0).optional(),
    stock_item: z.object({
        name: z.string(),
        unit: z.string(),
        unit_price: z.number().nullable().optional(),
    }).optional(),
});

export const TechnicalSheetSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    description: z.string().nullable().optional(),
    yield_quantity: z.number().min(0.001, "O rendimento deve ser maior que zero"),
    yield_unit: z.string(),
    category: z.string().nullable().optional(),
    total_cost: z.number().min(0).optional(),
    unit_cost: z.number().min(0).optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    ingredients: z.array(TechnicalSheetIngredientSchema).optional(),
});

export const TechnicalSheetInsertSchema = TechnicalSheetSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    total_cost: true,
    unit_cost: true,
    ingredients: true
});

export type TechnicalSheet = z.infer<typeof TechnicalSheetSchema>;
export type TechnicalSheetInsert = z.infer<typeof TechnicalSheetInsertSchema>;
export type TechnicalSheetUpdate = Partial<TechnicalSheetInsert>;
export type TechnicalSheetIngredient = z.infer<typeof TechnicalSheetIngredientSchema>;
