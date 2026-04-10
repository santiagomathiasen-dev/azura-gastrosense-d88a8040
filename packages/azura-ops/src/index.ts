// =============================================================================
// @azura/ops — API pública do módulo de Operações de Cozinha
//
// Este é o ÚNICO arquivo que consumidores externos devem importar.
// Nunca importe diretamente de src/modules/ops/**, src/modules/production/**
// ou src/modules/technical-sheets/** fora dos hooks OPS internos.
//
// Uso:
//   import { OpsReadService, OpsStockService } from '@azura/ops';
//   import type { FinishedStockItem, Production } from '@azura/ops';
// =============================================================================

// -----------------------------------------------------------------------------
// Serviços OPS (leitura e escrita de tabelas de estoque OPS)
// -----------------------------------------------------------------------------
export { OpsReadService } from '@/modules/ops/services/OpsReadService';
export { OpsStockService } from '@/modules/ops/services/OpsStockService';

// -----------------------------------------------------------------------------
// Tipos OPS
// -----------------------------------------------------------------------------
export type {
    FinishedStockItem,
    ProductionStockItem,
    OpsSheetSummary,
    StockDeductionResult,
} from '@/modules/ops/types';

// -----------------------------------------------------------------------------
// Serviço de Produção (contrato OPS → Compras)
// -----------------------------------------------------------------------------
export { ProductionService } from '@/modules/production/services/ProductionService';

// -----------------------------------------------------------------------------
// Tipos de Produção
// -----------------------------------------------------------------------------
export type {
    Production,
    ProductionInsert,
    ProductionUpdate,
    ProductionStatus,
    ProductionPeriod,
    ProductionWithSheet,
    PurchaseRequest,
} from '@/modules/production/types';

// Schemas Zod (para validação em runtime)
export {
    ProductionSchema,
    ProductionInsertSchema,
    ProductionStatusSchema,
} from '@/modules/production/types';

// -----------------------------------------------------------------------------
// Serviço de Fichas Técnicas
// -----------------------------------------------------------------------------
export { SheetCostsService } from '@/modules/technical-sheets/services/SheetCostsService';
export { TechnicalSheetService } from '@/modules/technical-sheets/services/TechnicalSheetService';

// -----------------------------------------------------------------------------
// Tipos de Fichas Técnicas
// -----------------------------------------------------------------------------
export type {
    SheetCosts,
    SheetCostsInsert,
    SheetCostsUpdate,
    SheetCostsComputed,
} from '@/modules/technical-sheets/types/sheet_costs';
