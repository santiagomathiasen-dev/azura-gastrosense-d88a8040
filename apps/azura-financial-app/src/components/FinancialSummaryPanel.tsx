// ---------------------------------------------------------------------------
// FinancialSummaryPanel — usa FinancialService do @azura/financial
// ---------------------------------------------------------------------------
import { useMemo, useState } from 'react';
import {
  FinancialService,
  type FinancialSummary,
  type ProductionHistoryItem,
} from '@azura/financial';

// ── Mock data ────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID();

const mockHistory: ProductionHistoryItem[] = [
  { technicalSheetId: uid(), technicalSheetName: 'Croissant Manteiga', yieldUnit: 'un', totalSales: 320, productionUsed: 300, currentStock: 15, toProduce: 25 },
  { technicalSheetId: uid(), technicalSheetName: 'Pão de Queijo',      yieldUnit: 'un', totalSales: 480, productionUsed: 460, currentStock: 8,  toProduce: 52 },
  { technicalSheetId: uid(), technicalSheetName: 'Molho Bechamel',     yieldUnit: 'L',  totalSales: 12,  productionUsed: 10,  currentStock: 2,  toProduce: 0  },
  { technicalSheetId: uid(), technicalSheetName: 'Bolo de Cenoura',    yieldUnit: 'un', totalSales: 40,  productionUsed: 38,  currentStock: 5,  toProduce: 15 },
  { technicalSheetId: uid(), technicalSheetName: 'Torta de Frango',    yieldUnit: 'un', totalSales: 95,  productionUsed: 90,  currentStock: 0,  toProduce: 20 },
];

const PERIODS = ['Hoje', 'Esta semana', 'Este mês'] as const;
type Period = typeof PERIODS[number];

const PERIOD_DATA: Record<Period, { revenue: number; cost: number; start: string; end: string }> = {
  'Hoje':        { revenue: 1840,  cost: 620,  start: '2026-04-10', end: '2026-04-10' },
  'Esta semana': { revenue: 9200,  cost: 3100, start: '2026-04-07', end: '2026-04-10' },
  'Este mês':    { revenue: 38400, cost: 12800, start: '2026-04-01', end: '2026-04-10' },
};

export function FinancialSummaryPanel() {
  const [period, setPeriod] = useState<Period>('Este mês');

  // Calcula resumo via FinancialService
  const summary: FinancialSummary = useMemo(() => {
    const d = PERIOD_DATA[period];
    return FinancialService.calcSummary(d.revenue, d.cost, d.start, d.end);
  }, [period]);

  // Ordena histórico por necessidade de produção
  const sortedHistory = useMemo(
    () => FinancialService.sortHistoryByNeed(FinancialService.filterActive(mockHistory)),
    []
  );

  const marginColor = summary.grossMarginPct >= 50 ? 'text-green-600' : summary.grossMarginPct >= 30 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors
              ${period === p ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard
          label="Receita Bruta"
          value={FinancialService.formatCurrency(summary.totalRevenue)}
          color="text-gray-800"
          sub={`${summary.periodStart} → ${summary.periodEnd}`}
        />
        <KPICard
          label="Custo Total"
          value={FinancialService.formatCurrency(summary.totalCost)}
          color="text-red-600"
        />
        <KPICard
          label="Margem Bruta"
          value={FinancialService.formatCurrency(summary.grossMargin)}
          color="text-green-600"
        />
        <KPICard
          label="% Margem"
          value={`${summary.grossMarginPct.toFixed(1)}%`}
          color={marginColor}
          big
        />
      </div>

      {/* Barra de margem */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Margem sobre receita</span>
          <span className={`text-sm font-bold ${marginColor}`}>{summary.grossMarginPct.toFixed(1)}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              summary.grossMarginPct >= 50 ? 'bg-green-500' : summary.grossMarginPct >= 30 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(summary.grossMarginPct, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      {/* Tabela de histórico de produção */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Fichas com maior necessidade de produção
        </h3>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Ficha Técnica</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Vendas</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Estoque</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">A produzir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedHistory.map(item => (
                <tr key={item.technicalSheetId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.technicalSheetName}</td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{item.totalSales} {item.yieldUnit}</td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{item.currentStock} {item.yieldUnit}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    <span className={item.toProduce > 0 ? 'text-orange-600' : 'text-green-600'}>
                      {item.toProduce > 0 ? `+${item.toProduce}` : '✓ Ok'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, color, sub, big }: { label: string; value: string; color: string; sub?: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-1 font-bold ${big ? 'text-3xl' : 'text-2xl'} ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
