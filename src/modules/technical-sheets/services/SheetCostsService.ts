import { supabaseFetch } from '../../../lib/supabase-fetch';
import type { SheetCosts, SheetCostsInsert, SheetCostsUpdate } from '../types/sheet_costs';

// =============================================================================
// FASE 3 — SheetCostsService
//
// Regra: NENHUM hook escreve diretamente em sheet_costs.
// Toda operação de custo passa por este serviço.
//
// Contratos públicos:
//   - getBySheetId()          — lê custos de uma ficha
//   - upsert()                — cria ou atualiza custos de uma ficha
//   - recalculate()           — recalcula total_cost e cost_per_unit e persiste
// =============================================================================

export class SheetCostsService {

    // -------------------------------------------------------------------------
    // LEITURA
    // -------------------------------------------------------------------------

    /** Retorna os custos de uma ficha técnica, ou null se ainda não existe. */
    static async getBySheetId(technicalSheetId: string): Promise<SheetCosts | null> {
        const data = await supabaseFetch(
            `sheet_costs?technical_sheet_id=eq.${technicalSheetId}&select=*`
        );
        const rows = Array.isArray(data) ? data : [data];
        return rows[0] ?? null;
    }

    /** Retorna os custos de múltiplas fichas de uma vez (batch). */
    static async getByOwner(ownerId: string): Promise<SheetCosts[]> {
        const data = await supabaseFetch(
            `sheet_costs?user_id=eq.${ownerId}&select=*`
        );
        return Array.isArray(data) ? data : [];
    }

    // -------------------------------------------------------------------------
    // ESCRITA
    // -------------------------------------------------------------------------

    /**
     * Cria ou atualiza os custos de uma ficha (upsert).
     * Recalcula automaticamente total_cost e cost_per_unit.
     */
    static async upsert(
        insert: SheetCostsInsert,
        yieldQuantity: number
    ): Promise<SheetCosts> {
        const laborCost   = Number(insert.labor_cost   ?? 0);
        const energyCost  = Number(insert.energy_cost  ?? 0);
        const otherCosts  = Number(insert.other_costs  ?? 0);
        const markup      = Number(insert.markup       ?? 0);
        const ingredientCost = Number((insert as any).ingredient_cost ?? 0);

        const total = laborCost + energyCost + otherCosts + ingredientCost;
        const costPerUnit = yieldQuantity > 0 ? total / yieldQuantity : 0;
        const targetPrice = markup > 0 ? costPerUnit * (1 + markup / 100) : null;

        const payload = {
            ...insert,
            total_cost:    total,
            cost_per_unit: costPerUnit,
            target_price:  insert.target_price ?? targetPrice,
        };

        // Upsert via Supabase PostgREST (ON CONFLICT (technical_sheet_id) DO UPDATE)
        const data = await supabaseFetch(
            'sheet_costs?on_conflict=technical_sheet_id',
            {
                method: 'POST',
                headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
                body: JSON.stringify(payload),
            }
        );

        const rows = Array.isArray(data) ? data : [data];
        return rows[0] as SheetCosts;
    }

    /**
     * Atualiza campos específicos de custo (PATCH).
     * Usado quando o usuário edita um campo individual na UI.
     */
    static async update(
        technicalSheetId: string,
        updates: SheetCostsUpdate,
        yieldQuantity?: number
    ): Promise<void> {
        // Se campos de custo foram alterados, recalcula os totais
        let patch = { ...updates } as any;

        if (
            yieldQuantity !== undefined &&
            (updates.labor_cost !== undefined ||
             updates.energy_cost !== undefined ||
             updates.other_costs !== undefined ||
             updates.markup !== undefined)
        ) {
            // Busca os valores atuais para recalcular
            const current = await SheetCostsService.getBySheetId(technicalSheetId);
            if (current) {
                const labor   = Number(updates.labor_cost  ?? current.labor_cost);
                const energy  = Number(updates.energy_cost ?? current.energy_cost);
                const other   = Number(updates.other_costs ?? current.other_costs);
                const markup  = Number(updates.markup      ?? current.markup);
                const ingredientCost = Number((current as any).ingredient_cost ?? 0);

                const total       = labor + energy + other + ingredientCost;
                const perUnit     = yieldQuantity > 0 ? total / yieldQuantity : 0;
                const targetPrice = markup > 0 ? perUnit * (1 + markup / 100) : null;

                patch.total_cost    = total;
                patch.cost_per_unit = perUnit;
                if (updates.target_price === undefined) {
                    patch.target_price = targetPrice;
                }
            }
        }

        await supabaseFetch(
            `sheet_costs?technical_sheet_id=eq.${technicalSheetId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            }
        );
    }

    /**
     * Remove o registro de custos de uma ficha.
     * Normalmente acionado via CASCADE quando a ficha é deletada.
     * Exposto aqui por completude.
     */
    static async remove(technicalSheetId: string): Promise<void> {
        await supabaseFetch(
            `sheet_costs?technical_sheet_id=eq.${technicalSheetId}`,
            { method: 'DELETE' }
        );
    }
}
