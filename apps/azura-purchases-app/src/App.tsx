import { PurchaseNeedsTable } from './components/PurchaseNeedsTable';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-lg">A</div>
          <div>
            <h1 className="text-lg font-bold leading-none text-gray-900">Azura</h1>
            <p className="text-xs text-gray-400 mt-0.5">Módulo · Compras</p>
          </div>
          <span className="ml-auto rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            @azura/purchases
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Compras</h2>
          <p className="mt-1 text-sm text-gray-500">
            Prioridade e custo calculados pelo{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-purple-600">PurchaseService</code> ·
            WhatsApp pelo{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-purple-600">SupplierService</code>.
          </p>
        </div>
        <PurchaseNeedsTable />
      </main>
    </div>
  );
}
