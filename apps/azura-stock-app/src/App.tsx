import { StockList } from './components/StockList';
import { mockStockItems } from './data/mockStock';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-lg">
            A
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none text-gray-900">Azura</h1>
            <p className="text-xs text-gray-400 mt-0.5">Módulo · Estoque</p>
          </div>
          {/* Indicador do módulo */}
          <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            @azura/stock
          </span>
        </div>
      </header>

      {/* ── Conteúdo principal ──────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Estoque</h2>
          <p className="mt-1 text-sm text-gray-500">
            Status calculado em tempo real pelo <code className="rounded bg-gray-100 px-1 py-0.5 text-blue-600">StockService</code>.
            Troque <code className="rounded bg-gray-100 px-1 py-0.5 text-blue-600">mockStockItems</code> por dados reais do Supabase.
          </p>
        </div>

        {/* Resumo KPI */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total de itens',  value: mockStockItems.length, color: 'text-gray-700' },
            { label: 'Em estoque Ok',   value: mockStockItems.filter(i => i.current_quantity > i.minimum_quantity * 1.2).length, color: 'text-green-600' },
            { label: 'Em alerta',       value: mockStockItems.filter(i => i.current_quantity <= i.minimum_quantity * 1.2 && i.current_quantity > 0).length, color: 'text-yellow-600' },
            { label: 'Crítico / zerado', value: mockStockItems.filter(i => i.current_quantity === 0 || i.is_expired).length, color: 'text-red-600' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-400">{kpi.label}</p>
              <p className={`mt-1 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <StockList items={mockStockItems} />
      </main>
    </div>
  );
}
