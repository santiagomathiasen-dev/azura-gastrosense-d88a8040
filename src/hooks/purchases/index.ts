// ------------------------------------------------------------------------------
// COMPRAS -- Barrel Export
// PurchaseNeedItem exportado APENAS de usePurchaseCalculation (fonte canonico).
// usePurchaseCalculationByPeriod reusa o tipo via import direto.
// ------------------------------------------------------------------------------

export * from './useSuppliers';
export * from './usePurchaseList';
export * from './usePurchaseCalculation';
// Exportacao seletiva para evitar conflito de PurchaseNeedItem:
export { usePurchaseCalculationByPeriod } from './usePurchaseCalculationByPeriod';
export * from './usePurchaseSchedule';
export * from './usePendingDeliveries';
export * from './useSupplierMessages';
export * from './useIngredientImport';