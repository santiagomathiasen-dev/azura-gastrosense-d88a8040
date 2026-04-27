import {
    ProductionStatus,
    ProductionWithSheet,
    PurchaseRequest,
} from '../types';
import { supabaseFetch } from '../../../lib/supabase-fetch';

export interface DeductionPlan {
    fromProduction: number;
    fromCentral: number;
    insufficient: number;
    batchDeductions: { batchId: string; take: number }[];
}

export class ProductionService {

    static getMultiplier(plannedQuantity: number, yieldQuantity: number): number {
        if (yieldQuantity <= 0) return 0;
        return plannedQuantity / yieldQuantity;
    }

    static calculateNeededQuantity(
        baseIngredientQuantity: number,
        multiplier: number,
        wasteFactorPercentage: number = 0
    ): number {
        const baseQty = baseIngredientQuantity * multiplier;
        const wasteFactor = wasteFactorPercentage / 100;
        return baseQty * (1 + wasteFactor);
    }

    static planStockDeduction(
        neededQty: number,
        availableInProduction: number,
        availableInCentral: number,
        expiryBatches: { id: string; quantity: number }[]
    ): DeductionPlan {
        let remaining = neededQty;
        const plan: DeductionPlan = {
            fromProduction: 0,
            fromCentral: 0,
            insufficient: 0,
            batchDeductions: []
        };

        if (availableInProduction > 0) {
            const take = Math.min(availableInProduction, remaining);
            plan.fromProduction = take;
            remaining -= take;
        }

        if (remaining > 0 && availableInCentral > 0) {
            const take = Math.min(availableInCentral, remaining);
            plan.fromCentral = take;

            let batchRemaining = take;
            for (const batch of expiryBatches) {
                if (batchRemaining <= 0) break;
                const batchTake = Math.min(batchRemaining, batch.quantity);
                plan.batchDeductions.push({ batchId: batch.id, take: batchTake });
                batchRemaining -= batchTake;
            }

            remaining -= take;
        }

        plan.insufficient = remaining;
        return plan;
    }

    static isStarting(oldStatus: ProductionStatus, newStatus: ProductionStatus): boolean {
        return (oldStatus === 'planned' || oldStatus === 'requested') && newStatus === 'in_progress';
    }

    static isCompleting(oldStatus: ProductionStatus, newStatus: ProductionStatus): boolean {
        return (oldStatus === 'in_progress' || oldStatus === 'paused') && newStatus === 'completed';
    }

    static generateBatchCode(sheetName: string): string {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const msStr = now.getTime().toString(36).slice(-3).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${sheetName.substring(0, 3).toUpperCase()}-${dateStr}-${msStr}${random}`;
    }

    // FASE 2: Contrato com Compras
    // O hook useProductions NAO escreve mais em purchase_list_items diretamente.
    static async requestPurchase(request: PurchaseRequest): Promise<void> {
        const { ownerId, stockItemId, quantity, productionName } = request;

        const existingData = await supabaseFetch(
            `purchase_list_items?stock_item_id=eq.${stockItemId}&status=eq.pending&select=id,suggested_quantity`
        );
        const existing = Array.isArray(existingData) ? existingData[0] : existingData;

        if (existing) {
            await supabaseFetch(`purchase_list_items?id=eq.${existing.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    suggested_quantity: Number(existing.suggested_quantity) + quantity
                })
            });
        } else {
            await supabaseFetch('purchase_list_items', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: ownerId,
                    stock_item_id: stockItemId,
                    suggested_quantity: quantity,
                    status: 'pending',
                    notes: `Gerado automaticamente - Producao: ${productionName}`,
                })
            });
        }
    }
}
