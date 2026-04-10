import { FinancialSummary, ProductionHistoryItem } from '../types';

export class FinancialService {
    /**
     * Calcula margem bruta de um período.
     * Interliga receita de vendas com custo de produção via Supabase.
     */
    static calcSummary(totalRevenue: number, totalCost: number, periodStart: string, periodEnd: string): FinancialSummary {
        const grossMargin = totalRevenue - totalCost;
        const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
        return { totalRevenue, totalCost, grossMargin, grossMarginPct, periodStart, periodEnd };
    }

    /**
     * Agrega histórico de produção por ficha técnica.
     * Ordena por maior necessidade de produção primeiro.
     */
    static sortHistoryByNeed(items: ProductionHistoryItem[]): ProductionHistoryItem[] {
        return [...items].sort((a, b) => b.toProduce - a.toProduce);
    }

    /**
     * Filtra apenas fichas com atividade (vendas > 0 ou estoque > 0).
     */
    static filterActive(items: ProductionHistoryItem[]): ProductionHistoryItem[] {
        return items.filter(i => i.totalSales > 0 || i.currentStock > 0);
    }

    /** Formata valor monetário em BRL. */
    static formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
}
