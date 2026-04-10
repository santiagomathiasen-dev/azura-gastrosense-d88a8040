// ---------------------------------------------------------------------------
// StockList — consome StockService do @azura/stock para calcular status,
// filtrar alertas e exibir a lista completa com badges coloridos.
// ---------------------------------------------------------------------------
import { useState, useMemo } from 'react';
import {
  StockService,
  CATEGORY_LABELS,
  UNIT_LABELS,
  type StockItem,
  type StockCategory,
} from '@azura/stock';

interface Props {
  items: StockItem[];
}

const ALL = '__all__' as const;

export function StockList({ items }: Props) {
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState<StockCategory | typeof ALL>(ALL);

  // Itens em alerta (vermelho ou amarelo) — usa método do StockService
  const alertItems = useMemo(
    () => StockService.getItemsInAlert(items),
    [items]
  );

  // Filtros
  const filtered = useMemo(() => {
    return items
      .filter(i => category === ALL || i.category === category)
      .filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, category, search]);

  // Categorias presentes na lista (para montar os filtros)
  const categories = useMemo(
    () => [...new Set(items.map(i => i.category))] as StockCategory[],
    [items]
  );

  return (
    <div className="space-y-6">
      {/* ── Banner de alertas ──────────────────────────────────────────── */}
      {alertItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="mt-0.5 text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-700">
              {alertItems.length} {alertItems.length === 1 ? 'item precisa' : 'itens precisam'} de atenção
            </p>
            <p className="mt-0.5 text-sm text-red-600">
              {alertItems.map(i => i.name).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Barra de busca + filtros ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Campo de busca */}
        <input
          type="text"
          placeholder="Buscar item…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm shadow-sm
                     focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200
                     w-52"
        />

        {/* Filtro de categoria */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(ALL)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${category === ALL
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
                ${category === cat
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} / {items.length} itens
        </span>
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3 font-semibold text-gray-600">Item</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Categoria</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Estoque atual</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Mínimo</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Preço/un.</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400">
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
            {filtered.map(item => {
              // ← Aqui usamos o StockService para calcular o status do item
              const status = StockService.getDetailedStatus(
                item.current_quantity,
                item.minimum_quantity,
                item.is_expired
              );
              const unit = UNIT_LABELS[item.unit] ?? item.unit;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Nome */}
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.name}
                    {item.is_expired && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                        Vencido
                      </span>
                    )}
                  </td>

                  {/* Categoria */}
                  <td className="px-4 py-3 text-gray-500">
                    {CATEGORY_LABELS[item.category]}
                  </td>

                  {/* Qtd atual */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={`font-semibold ${
                        status.status === 'red'
                          ? 'text-red-600'
                          : status.status === 'yellow'
                          ? 'text-yellow-700'
                          : 'text-gray-800'
                      }`}
                    >
                      {item.current_quantity}
                    </span>
                    <span className="ml-1 text-gray-400">{unit}</span>
                  </td>

                  {/* Mínimo */}
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {item.minimum_quantity} {unit}
                  </td>

                  {/* Preço */}
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {item.unit_price != null
                      ? `R$ ${item.unit_price.toFixed(2)}`
                      : '—'}
                  </td>

                  {/* Badge de status — cor gerada pelo StockService */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}
                    >
                      {status.status === 'red'   && '🔴 '}
                      {status.status === 'yellow' && '🟡 '}
                      {status.status === 'green'  && '🟢 '}
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
