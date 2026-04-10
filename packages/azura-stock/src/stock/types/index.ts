import { z } from 'zod';

export const StockCategorySchema = z.enum([
    'laticinios',
    'secos_e_graos',
    'hortifruti',
    'carnes_e_peixes',
    'embalagens',
    'limpeza',
    'outros'
]);

export const StockUnitSchema = z.enum([
    'kg',
    'g',
    'L',
    'ml',
    'unidade',
    'caixa',
    'dz'
]);

export const StockItemSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    current_quantity: z.number().min(0, "A quantidade não pode ser negativa"),
    minimum_quantity: z.number().min(0, "A quantidade mínima não pode ser negativa"),
    unit: StockUnitSchema,
    category: StockCategorySchema,
    unit_price: z.number().nullable().optional(),
    supplier_id: z.string().uuid().nullable().optional(),
    waste_factor: z.number().min(0).nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    is_expired: z.boolean().optional(),
});

export const StockItemInsertSchema = StockItemSchema.omit({
    id: true,
    created_at: true,
    updated_at: true
});

export type StockItem = z.infer<typeof StockItemSchema>;
export type StockItemInsert = z.infer<typeof StockItemInsertSchema>;
export type StockItemUpdate = Partial<StockItemInsert>;
export type StockCategory = z.infer<typeof StockCategorySchema>;
export type StockUnit = z.infer<typeof StockUnitSchema>;

export interface StockStatus {
    status: 'green' | 'yellow' | 'red';
    label: string;
    color: string;
}

export interface StockItemWithSupplier extends StockItem {
    suppliers?: { name: string } | null;
}

export const CATEGORY_LABELS: Record<StockCategory, string> = {
    laticinios: 'Laticínios',
    secos_e_graos: 'Secos e Grãos',
    hortifruti: 'Hortifruti',
    carnes_e_peixes: 'Carnes e Peixes',
    embalagens: 'Embalagens',
    limpeza: 'Limpeza',
    outros: 'Outros',
};

export const UNIT_LABELS: Record<StockUnit, string> = {
    kg: 'kg',
    g: 'g',
    L: 'L',
    ml: 'ml',
    unidade: 'un',
    caixa: 'cx',
    dz: 'dz',
};
