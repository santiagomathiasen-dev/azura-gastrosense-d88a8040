import { ProductionDashboard } from './components/ProductionDashboard';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-lg">A</div>
          <div>
            <h1 className="text-lg font-bold leading-none text-gray-900">Azura</h1>
            <p className="text-xs text-gray-400 mt-0.5">Módulo · Operações</p>
          </div>
          <span className="ml-auto rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-200">
            @azura/ops
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard de Produção</h2>
          <p className="mt-1 text-sm text-gray-500">
            Multiplicadores e lotes calculados pelo <code className="rounded bg-gray-100 px-1 py-0.5 text-orange-600">ProductionService</code> · custos pelo{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-orange-600">TechnicalSheetService</code>.
          </p>
        </div>
        <ProductionDashboard />
      </main>
    </div>
  );
}
