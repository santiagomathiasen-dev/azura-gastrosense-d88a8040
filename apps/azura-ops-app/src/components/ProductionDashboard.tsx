// ---------------------------------------------------------------------------
// ProductionDashboard — usa ProductionService e TechnicalSheetService do @azura/ops
// ---------------------------------------------------------------------------
import { useState, useMemo } from 'react';
import {
  ProductionService,
  TechnicalSheetService,
  type Production,
  type ProductionStatus,
  type TechnicalSheet,
} from '@azura/ops';

// ── Mock data ────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID();
const ownerId = '00000000-0000-0000-0000-000000000001';

const mockSheets: TechnicalSheet[] = [
  { id: uid(), user_id: ownerId, name: 'Croissant Manteiga', yield_quantity: 20, yield_unit: 'unidade', production_type: 'final', minimum_stock: 10, labor_cost: 15, energy_cost: 5, other_costs: 2, markup: 60, preparation_method: 'Laminação em 3 dobras', ingredients: [] },
  { id: uid(), user_id: ownerId, name: 'Pão de Queijo',      yield_quantity: 50, yield_unit: 'unidade', production_type: 'final', minimum_stock: 30, labor_cost: 8,  energy_cost: 3, other_costs: 1, markup: 70, preparation_method: 'Escaldar polvilho', ingredients: [] },
  { id: uid(), user_id: ownerId, name: 'Molho Bechamel',     yield_quantity: 2,  yield_unit: 'L',       production_type: 'insumo', minimum_stock: 1, labor_cost: 5,  energy_cost: 2, other_costs: 0, markup: 40, preparation_method: 'Roux + leite', ingredients: [] },
];

const sheetMap = Object.fromEntries(mockSheets.map(s => [s.id, s]));

const mockProductions: Production[] = [
  { id: uid(), user_id: ownerId, technical_sheet_id: mockSheets[0].id, name: 'Croissant Manhã',   status: 'planned',     planned_quantity: 40, scheduled_date: '2026-04-10', praca: 'Forno 1' },
  { id: uid(), user_id: ownerId, technical_sheet_id: mockSheets[1].id, name: 'Pão de Queijo Tarde', status: 'in_progress', planned_quantity: 100, scheduled_date: '2026-04-10', praca: 'Forno 2' },
  { id: uid(), user_id: ownerId, technical_sheet_id: mockSheets[0].id, name: 'Croissant Especial', status: 'completed',   planned_quantity: 20, actual_quantity: 19, scheduled_date: '2026-04-09' },
  { id: uid(), user_id: ownerId, technical_sheet_id: mockSheets[2].id, name: 'Bechamel Semana',    status: 'requested',   planned_quantity: 4,  scheduled_date: '2026-04-11' },
  { id: uid(), user_id: ownerId, technical_sheet_id: mockSheets[1].id, name: 'Pão de Queijo Extra', status: 'paused',     planned_quantity: 60, scheduled_date: '2026-04-10', praca: 'Forno 1' },
];

// ── Status helpers ────────────────────────────────────────────────────────
const STATUS_STYLE: Record<ProductionStatus, string> = {
  requested:   'bg-gray-100 text-gray-600',
  planned:     'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  paused:      'bg-orange-100 text-orange-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-600',
};
const STATUS_LABEL: Record<ProductionStatus, string> = {
  requested: 'Solicitada', planned: 'Planejada', in_progress: 'Em andamento',
  paused: 'Pausada', completed: 'Concluída', cancelled: 'Cancelada',
};

export function ProductionDashboard() {
  const [filter, setFilter] = useState<ProductionStatus | '__all__'>('__all__');

  const filtered = useMemo(
    () => filter === '__all__' ? mockProductions : mockProductions.filter(p => p.status === filter),
    [filter]
  );

  return (
    <div className="space-y-6">
      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2">
        {(['__all__', 'planned', 'in_progress', 'paused', 'requested', 'completed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border
              ${filter === s ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            {s === '__all__' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Cards de produção */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(prod => {
          const sheet = sheetMap[prod.technical_sheet_id];
          // Calcula o multiplicador via ProductionService
          const mult = ProductionService.getMultiplier(
            prod.planned_quantity,
            sheet?.yield_quantity ?? 1
          );
          // Gera exemplo de lote via ProductionService
          const batchCode = ProductionService.generateBatchCode(prod.name);
          // Custo unitário via TechnicalSheetService
          const unitCost = sheet
            ? TechnicalSheetService.calculateUnitCost(
                TechnicalSheetService.calculateTotalCost(sheet.ingredients ?? []),
                sheet.yield_quantity
              )
            : 0;

          return (
            <div key={prod.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-gray-900 leading-tight">{prod.name}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[prod.status]}`}>
                  {STATUS_LABEL[prod.status]}
                </span>
              </div>

              <p className="text-xs text-gray-400 mb-4">Ficha: <span className="text-gray-600 font-medium">{sheet?.name}</span></p>

              <div className="space-y-1.5 text-sm">
                <Row label="Qtd. planejada" value={`${prod.planned_quantity} ${sheet?.yield_unit ?? ''}`} />
                <Row label="Multiplicador"  value={`× ${mult.toFixed(2)}`} />
                {prod.actual_quantity != null && (
                  <Row label="Qtd. real" value={`${prod.actual_quantity} ${sheet?.yield_unit ?? ''}`} highlight />
                )}
                <Row label="Praça"      value={prod.praca ?? '—'} />
                <Row label="Data"       value={prod.scheduled_date} />
                {unitCost > 0 && <Row label="Custo unitário" value={`R$ ${unitCost.toFixed(2)}`} />}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Lote gerado</p>
                <code className="text-xs font-mono text-blue-600">{batchCode}</code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${highlight ? 'text-green-600' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}
