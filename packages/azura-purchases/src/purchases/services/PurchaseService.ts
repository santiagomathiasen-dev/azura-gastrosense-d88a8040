import { PurchaseNeedItem, DAY_NAMES } from '../types';

export class PurchaseService {
    /**
     * Calcula quanto precisa comprar de um item considerando estoque atual,
     * estoque de produção e necessidade prevista.
     * Interliga dados de estoque central + estoque de produção via Supabase.
     */
    static calculateToBuy(
        productionNeed: number,
        minimumQty: number,
        centralStock: number,
        productionStock: number
    ): number {
        const totalAvailable = centralStock + productionStock;
        const required = productionNeed + minimumQty;
        return Math.max(0, required - totalAvailable);
    }

    /** Retorna o custo estimado de compra de um item. */
    static estimateCost(quantity: number, unitPrice: number | null | undefined): number {
        if (!unitPrice || unitPrice <= 0) return 0;
        return quantity * unitPrice;
    }

    /** Soma o custo estimado de todos os itens da lista. */
    static calcTotalEstimated(items: PurchaseNeedItem[]): number {
        return items.reduce((sum, item) => sum + item.estimatedCost, 0);
    }

    /** Ordena itens: urgentes primeiro, depois por nome. */
    static sortByPriority(items: PurchaseNeedItem[]): PurchaseNeedItem[] {
        return [...items].sort((a, b) => {
            if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
            return a.name.localeCompare(b.name, 'pt-BR');
        });
    }

    /** Retorna o próximo dia da semana agendado para compra. */
    static getNextPurchaseDay(scheduledDays: number[]): { dayIndex: number; dayName: string; date: Date } | null {
        if (!scheduledDays.length) return null;
        const today = new Date().getDay();
        const sorted = [...scheduledDays].sort((a, b) => a - b);
        const next = sorted.find(d => d >= today) ?? sorted[0];
        const daysAhead = next >= today ? next - today : 7 - today + next;
        const date = new Date();
        date.setDate(date.getDate() + daysAhead);
        return { dayIndex: next, dayName: DAY_NAMES[next], date };
    }
}
