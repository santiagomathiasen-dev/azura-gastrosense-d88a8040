import { useMemo } from 'react';
import { useStockItems, UNIT_LABELS, CATEGORY_LABELS } from '../stock/useStockItems';
import { useSuppliers } from './useSuppliers';
import { useProductionStock } from '../ops/useProductionStock';
import { useSaleProducts } from '../financial/useSaleProducts';
import { useTechnicalSheets } from '../ops/useTechnicalSheets';
import type { ProductionWithSheet } from '../ops/useProductions';

export interface PurchaseNeedItem {
  stockItemId: string;
  name: string;
  category: string;
  unit: string;
  currentQuantity: number;
  productionStockQuantity: number;
  totalAvailable: number;
  minimumQuantity: number;
  productionNeed: number;
  wasteFactor: number;
  suggestedQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierPhone: string | null;
  unitPrice: number;
  estimatedCost: number;
  isUrgent: boolean;
}

interface UsePurchaseCalculationByPeriodParams {
  productions: ProductionWithSheet[];
}

export function usePurchaseCalculationByPeriod({ productions }: UsePurchaseCalculationByPeriodParams) {
  const { items: stockItems, isLoading: stockLoading } = useStockItems();
  const { suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { productionStock, isLoading: productionStockLoading } = useProductionStock();
  const { saleProducts, isLoading: saleProductsLoading } = useSaleProducts();
  const { sheets, isLoading: sheetsLoading } = useTechnicalSheets();

  // Pre-compute a stockItemId → totalDemand map in a single O(productions + saleProducts) pass.
  // Previously this was called once per stock item, making it O(stockItems × productions) = very slow.
  const demandByStockItem = useMemo(() => {
    const demand: Record<string, number> = {};

    const addDemand = (stockItemId: string, qty: number) => {
      demand[stockItemId] = (demand[stockItemId] || 0) + qty;
    };

    // Build sheet lookup map
    const sheetMap = new Map(sheets.map(s => [s.id, s]));

    // Explode a technical sheet's ingredients into the demand map
    const explodeSheet = (sheetId: string, multiplier: number) => {
      const sheet = sheetMap.get(sheetId);
      if (!sheet?.ingredients) return;
      const finalMultiplier = multiplier / Number(sheet.yield_quantity || 1);
      for (const ing of sheet.ingredients) {
        addDemand(ing.stock_item_id, Number(ing.quantity) * finalMultiplier);
      }
    };

    // Build sale product lookup map
    const productMap = new Map(saleProducts.map(p => [p.id, p]));

    // Recursively explode a sale product's components into the demand map
    const explodeProduct = (productId: string, multiplier: number, depth = 0) => {
      if (depth > 10) return; // guard circular deps
      const product = productMap.get(productId);
      if (!product?.components) return;
      for (const component of product.components) {
        const compQty = Number(component.quantity) * multiplier;
        if (component.component_type === 'stock_item') {
          addDemand(component.component_id, compQty);
        } else if (component.component_type === 'finished_production') {
          explodeSheet(component.component_id, compQty);
        } else if (component.component_type === 'sale_product') {
          explodeProduct(component.component_id, compQty, depth + 1);
        }
      }
    };

    // 1. Demand from Planned Productions
    for (const production of productions) {
      if (!production.technical_sheet || production.status !== 'planned') continue;
      const yieldQty = Number(production.technical_sheet.yield_quantity || 1);
      const multiplier = Number(production.planned_quantity) / yieldQty;
      for (const ing of (production.technical_sheet.ingredients || [])) {
        addDemand(ing.stock_item_id, Number(ing.quantity) * multiplier);
      }
    }

    // 2. Demand from Sale Products below minimum stock
    for (const product of saleProducts) {
      const gap = Math.max(0, (product.minimum_stock || 0) - (product.ready_quantity || 0));
      if (gap > 0) {
        explodeProduct(product.id, gap);
      }
    }

    return demand;
  }, [productions, saleProducts, sheets]);

  const purchaseNeeds = useMemo(() => {
    if (!stockItems.length) return [];

    const needs: PurchaseNeedItem[] = [];

    for (const item of stockItems) {
      const currentQty = Number(item.current_quantity);
      const minQty = Number(item.minimum_quantity);
      const wasteFactor = Number((item as any).waste_factor || 0) / 100;

      // Get production stock quantity for this item
      const prodStockItem = productionStock.find(ps => ps.stock_item_id === item.id);
      const productionStockQty = prodStockItem ? Number(prodStockItem.quantity) : 0;

      // Total available = central + production stock
      const totalAvailable = currentQty + productionStockQty;

      // Get production need (includes productions + sale products gap)
      const baseDemand = demandByStockItem[item.id] || 0;
      const totalProjectedNeed = baseDemand * (1 + wasteFactor);

      // Formula: Need = (Total Projected Need + Minimum Stock) - Total Available
      const totalNeed = (totalProjectedNeed + minQty) - totalAvailable;

      // Only include if need > 0 (ignore negative values)
      if (totalNeed > 0) {
        const supplier = item.supplier_id
          ? suppliers.find(s => s.id === item.supplier_id)
          : null;

        const unitPrice = Number(item.unit_price) || 0;
        const isUrgent = totalAvailable <= minQty;

        needs.push({
          stockItemId: item.id,
          name: item.name,
          category: CATEGORY_LABELS[item.category] || item.category,
          unit: UNIT_LABELS[item.unit] || item.unit,
          currentQuantity: currentQty,
          productionStockQuantity: productionStockQty,
          totalAvailable,
          minimumQuantity: minQty,
          productionNeed: totalProjectedNeed,
          wasteFactor: wasteFactor * 100,
          suggestedQuantity: Math.ceil(totalNeed), // Round up to ensure enough
          supplierId: item.supplier_id,
          supplierName: supplier?.name || null,
          supplierPhone: supplier?.whatsapp_number || supplier?.whatsapp || supplier?.phone || null,
          unitPrice,
          estimatedCost: Math.ceil(totalNeed) * unitPrice,
          isUrgent,
        });
      }
    }

    // Sort by urgency first, then by name
    return needs.sort((a, b) => {
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [stockItems, suppliers, demandByStockItem, productionStock]);

  const urgentCount = purchaseNeeds.filter(item => item.isUrgent).length;
  const totalEstimatedCost = purchaseNeeds.reduce((sum, item) => sum + item.estimatedCost, 0);

  return {
    purchaseNeeds,
    urgentCount,
    totalEstimatedCost,
    isLoading: stockLoading || suppliersLoading || productionStockLoading || saleProductsLoading || sheetsLoading,
    plannedProductionsCount: productions.filter(p => p.status === 'planned').length,
  };
}
