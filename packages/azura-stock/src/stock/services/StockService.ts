import { StockStatus, StockItemSchema, StockItemInsertSchema, StockItem } from '../types';

export class StockService {
    static validateItem(item: any): StockItem {
        return StockItemSchema.parse(item);
    }

    static validateInsert(item: any) {
        return StockItemInsertSchema.parse(item);
    }

    /**
     * Calcula o status de um item com base na quantidade atual vs mínima.
     */
    static getStockStatus(currentQty: number, minimumQty: number, isExpired?: boolean): 'green' | 'yellow' | 'red' {
        if (isExpired || currentQty <= minimumQty) return 'red';
        if (currentQty <= minimumQty * 1.2) return 'yellow';
        return 'green';
    }

    static getDetailedStatus(currentQty: number, minimumQty: number, isExpired?: boolean): StockStatus {
        const status = this.getStockStatus(currentQty, minimumQty, isExpired);
        switch (status) {
            case 'red':   return { status: 'red',    label: 'Crítico', color: 'text-red-600 bg-red-100' };
            case 'yellow': return { status: 'yellow', label: 'Alerta',  color: 'text-yellow-600 bg-yellow-100' };
            default:       return { status: 'green',  label: 'Ok',      color: 'text-green-600 bg-green-100' };
        }
    }

    static getItemsInAlert<T extends { current_quantity?: any; minimum_quantity?: any; is_expired?: boolean }>(items: T[]): T[] {
        return items.filter(item =>
            this.getStockStatus(Number(item.current_quantity), Number(item.minimum_quantity), item.is_expired) !== 'green'
        );
    }

    /**
     * Calcula a quantidade disponível descontando waste factor.
     * Interliga com dados de produção via quantity bruta.
     */
    static getUsableQuantity(quantity: number, wasteFactorPct: number = 0): number {
        if (wasteFactorPct <= 0) return quantity;
        return quantity / (1 + wasteFactorPct / 100);
    }
}
