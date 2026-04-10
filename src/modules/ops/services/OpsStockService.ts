import { supabaseFetch } from '../../../lib/supabase-fetch';
import { OpsReadService } from './OpsReadService';
import type { StockDeductionResult } from '../types';

// =============================================================================
// FASE 4 — OpsStockService
//
// Regra: Este service é o ÚNICO ponto de ESCRITA em tabelas de estoque OPS
// para módulos externos (Financial/PDV, Stock).
//
// Tabelas OPS gerenciadas aqui para escrita externa:
//   - finished_productions_stock  (dedução para venda ou perda)
//   - production_stock            (dedução para transferência / solicitação)
//
// Hooks OPS continuam escrevendo diretamente (são donos do módulo).
// =============================================================================

export class OpsStockService {

    // -------------------------------------------------------------------------
    // finished_productions_stock — dedução para venda (PDV/Financial)
    // -------------------------------------------------------------------------

    /**
     * Deduz quantidade do estoque de produções finalizadas para uma venda.
     * Chamado por useSaleProducts ao registrar uma venda com componente
     * do tipo 'finished_production'.
     */
    static async deductFinishedStock(
        technicalSheetId: string,
        quantity: number,
        praca?: string | null
    ): Promise<StockDeductionResult> {
        const stock = await OpsReadService.getFinishedStockBySheet(technicalSheetId, praca);

        if (!stock) {
            return { success: false, deducted: 0, remaining: 0, warning: 'Estoque finalizado nao encontrado' };
        }

        const current = Number(stock.quantity);
        const toDeduct = Math.min(quantity, current);
        const newQty = current - toDeduct;

        if (newQty <= 0) {
            await supabaseFetch(`finished_productions_stock?id=eq.${stock.id}`, { method: 'DELETE' });
        } else {
            await supabaseFetch(`finished_productions_stock?id=eq.${stock.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ quantity: newQty }),
            });
        }

        return {
            success: true,
            deducted: toDeduct,
            remaining: Math.max(0, newQty),
            warning: toDeduct < quantity
                ? `Estoque insuficiente: solicitado ${quantity}, deduzido ${toDeduct}`
                : undefined,
        };
    }

    /**
     * Deduz quantidade do estoque de produções finalizadas pelo ID do registro.
     * Usado por useLosses para registrar perda de produção finalizada.
     */
    static async deductFinishedStockById(
        stockId: string,
        quantity: number
    ): Promise<StockDeductionResult> {
        const stock = await OpsReadService.getFinishedStockById(stockId);

        if (!stock) {
            return { success: false, deducted: 0, remaining: 0, warning: 'Registro nao encontrado' };
        }

        const current = Number(stock.quantity);
        const newQty = current - quantity;

        if (newQty <= 0) {
            await supabaseFetch(`finished_productions_stock?id=eq.${stockId}`, { method: 'DELETE' });
        } else {
            await supabaseFetch(`finished_productions_stock?id=eq.${stockId}`, {
                method: 'PATCH',
                body: JSON.stringify({ quantity: newQty }),
            });
        }

        return {
            success: true,
            deducted: quantity,
            remaining: Math.max(0, newQty),
        };
    }

    // -------------------------------------------------------------------------
    // production_stock — dedução para transferência (Stock)
    // -------------------------------------------------------------------------

    /**
     * Deduz ou adiciona quantidade ao estoque de produção de um item.
     * Chamado por useStockRequests ao atender uma solicitação de estoque.
     */
    static async updateProductionStock(
        stockItemId: string,
        delta: number,        // positivo = adiciona, negativo = deduz
        ownerId: string
    ): Promise<void> {
        const existing = await OpsReadService.getProductionStockByItem(stockItemId);

        if (existing) {
            const newQty = Number(existing.quantity) + delta;
            if (newQty <= 0) {
                await supabaseFetch(`production_stock?id=eq.${existing.id}`, { method: 'DELETE' });
            } else {
                await supabaseFetch(`production_stock?id=eq.${existing.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ quantity: newQty }),
                });
            }
        } else if (delta > 0) {
            await supabaseFetch('production_stock', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: ownerId,
                    stock_item_id: stockItemId,
                    quantity: delta,
                }),
            });
        }
    }
}
