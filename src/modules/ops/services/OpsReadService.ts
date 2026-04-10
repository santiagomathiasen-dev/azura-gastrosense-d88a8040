import { supabaseFetch } from '../../../lib/supabase-fetch';
import type {
    FinishedStockItem,
    ProductionStockItem,
    OpsSheetSummary,
} from '../types';

// =============================================================================
// FASE 4 — OpsReadService
//
// Regra: Este service é o ÚNICO ponto de acesso de leitura às tabelas OPS
// para módulos externos (Financial, PDV, Stock).
//
// Tabelas OPS encapsuladas aqui:
//   - finished_productions_stock
//   - produced_inputs_stock
//   - production_stock
//   - technical_sheets  (leitura resumida apenas)
//
// NÃO use este service dentro de src/hooks/ops/ — os hooks OPS acessam
// as tabelas diretamente (são os "donos" do módulo).
// =============================================================================

export class OpsReadService {

    // -------------------------------------------------------------------------
    // finished_productions_stock
    // -------------------------------------------------------------------------

    /** Retorna todo o estoque de produções finalizadas de um dono. */
    static async getFinishedStock(ownerId: string): Promise<FinishedStockItem[]> {
        const data = await supabaseFetch(
            `finished_productions_stock?user_id=eq.${ownerId}&select=id,technical_sheet_id,quantity,unit,praca,notes,technical_sheet:technical_sheets(name)&order=created_at.desc`
        );
        return Array.isArray(data) ? data : [];
    }

    /** Retorna o estoque finalizado de uma ficha técnica específica. */
    static async getFinishedStockBySheet(
        technicalSheetId: string,
        praca?: string | null
    ): Promise<FinishedStockItem | null> {
        let path = `finished_productions_stock?technical_sheet_id=eq.${technicalSheetId}&select=id,technical_sheet_id,quantity,unit,praca,notes`;
        if (praca) {
            path += `&praca=eq.${praca}`;
        } else {
            path += '&praca=is.null';
        }
        const data = await supabaseFetch(path);
        const rows = Array.isArray(data) ? data : [data];
        return rows[0] ?? null;
    }

    /** Retorna o estoque finalizado de um item de estoque (para perdas/requests). */
    static async getFinishedStockById(id: string): Promise<FinishedStockItem | null> {
        const data = await supabaseFetch(
            `finished_productions_stock?id=eq.${id}&select=id,technical_sheet_id,quantity,unit,praca,notes`
        );
        const rows = Array.isArray(data) ? data : [data];
        return rows[0] ?? null;
    }

    // -------------------------------------------------------------------------
    // production_stock
    // -------------------------------------------------------------------------

    /** Retorna o estoque de produção de um item de estoque. */
    static async getProductionStockByItem(stockItemId: string): Promise<ProductionStockItem | null> {
        const data = await supabaseFetch(
            `production_stock?stock_item_id=eq.${stockItemId}&select=id,stock_item_id,quantity,stock_item:stock_items(name)`
        );
        const rows = Array.isArray(data) ? data : [data];
        return rows[0] ?? null;
    }

    /** Retorna o estoque de produção por ID do registro. */
    static async getProductionStockById(id: string): Promise<ProductionStockItem | null> {
        const data = await supabaseFetch(
            `production_stock?id=eq.${id}&select=id,stock_item_id,quantity`
        );
        const rows = Array.isArray(data) ? data : [data];
        return rows[0] ?? null;
    }

    // -------------------------------------------------------------------------
    // technical_sheets (resumo para PDV — sem ingredientes ou estágios)
    // -------------------------------------------------------------------------

    /** Retorna um resumo de ficha técnica para exibição no PDV. */
    static async getSheetSummary(id: string): Promise<OpsSheetSummary | null> {
        const data = await supabaseFetch(
            `technical_sheets?id=eq.${id}&select=id,name,yield_quantity,yield_unit,production_type,cost_per_unit,total_cost`
        );
        const rows = Array.isArray(data) ? data : [data];
        return rows[0] ?? null;
    }

    /** Retorna resumos de todas as fichas de um dono (para seletores no PDV). */
    static async getAllSheetSummaries(ownerId: string): Promise<OpsSheetSummary[]> {
        const data = await supabaseFetch(
            `technical_sheets?user_id=eq.${ownerId}&select=id,name,yield_quantity,yield_unit,production_type,cost_per_unit,total_cost&order=name.asc`
        );
        return Array.isArray(data) ? data : [];
    }
}
