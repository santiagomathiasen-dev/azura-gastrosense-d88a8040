import { z } from 'zod';

export const PurchaseStatusSchema = z.enum(['pending', 'ordered', 'received', 'cancelled']);

export const PurchaseListItemSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    stock_item_id: z.string().uuid(),
    supplier_id: z.string().uuid().nullable().optional(),
    quantity: z.number().positive(),
    unit: z.string(),
    unit_price: z.number().nullable().optional(),
    status: PurchaseStatusSchema.default('pending'),
    scheduled_date: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export const PurchaseScheduleSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    day_of_week: z.number().min(0).max(6),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
});

export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>;
export type PurchaseListItem = z.infer<typeof PurchaseListItemSchema>;
export type PurchaseSchedule = z.infer<typeof PurchaseScheduleSchema>;

/** Item enriquecido com joins de stock_item e supplier */
export interface PurchaseListItemWithDetails extends PurchaseListItem {
    stock_item?: { name: string; unit: string; unit_price?: number | null } | null;
    supplier?: { name: string; whatsapp_number?: string | null } | null;
}

/** Resultado do cálculo de necessidade de compra */
export interface PurchaseNeedItem {
    stockItemId: string;
    name: string;
    category: string;
    unit: string;
    currentQty: number;
    minimumQty: number;
    productionNeed: number;
    totalAvailable: number;
    toBuy: number;
    estimatedCost: number;
    isUrgent: boolean;
    supplierId?: string | null;
    supplierName?: string | null;
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
    pending: 'Pendente',
    ordered: 'Pedido',
    received: 'Recebido',
    cancelled: 'Cancelado',
};

export const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
