import { TechnicalSheet, TechnicalSheetSchema, TechnicalSheetInsertSchema, TechnicalSheetIngredient } from '../types';

export class TechnicalSheetService {
    /**
     * Validates a technical sheet.
     */
    static validateSheet(sheet: any): TechnicalSheet {
        return TechnicalSheetSchema.parse(sheet);
    }

    /**
     * Validates a partial technical sheet for creation.
     */
    static validateInsert(sheet: any) {
        return TechnicalSheetInsertSchema.parse(sheet);
    }

    /**
     * Calculates total cost based on ingredients.
     */
    static calculateTotalCost(ingredients: TechnicalSheetIngredient[]): number {
        if (!ingredients?.length) return 0;
        return ingredients.reduce((total, ing) => {
            const price = ing.stock_item?.unit_price || 0;
            return total + (ing.quantity * price);
        }, 0);
    }

    /**
     * Calculates unit cost based on total cost and yield.
     */
    static calculateUnitCost(totalCost: number, yieldQty: number): number {
        if (yieldQty <= 0) return 0;
        return totalCost / yieldQty;
    }
}
