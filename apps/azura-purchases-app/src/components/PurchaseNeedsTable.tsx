// ---------------------------------------------------------------------------
// PurchaseNeedsTable — usa tipos e labels do @azura/purchases para
// mostrar o que precisa ser comprado e calcular urgência.
// ---------------------------------------------------------------------------
import { useMemo, useState } from 'react';
import {
  PurchaseService,
  PURCHASE_STATUS_LABELS,
  type PurchaseNeedItem,
  type PurchaseListItemWithDetails,
  type PurchaseStatus,
} from '@azura/purchases';

// ── Mock data ────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID();
const ownerId = '00000000-0000-0000-0000-000000000001';

const mockNeeds: PurchaseNeedItem[] = [
  { stockItemId: uid(), name: 'Manteiga sem Sal',  category: 'laticinios',      unit: 'kg',      currentQty: 0,  minimumQty: 2,  productionNeed: 3,  totalAvailable: 0,  toBuy: 5,  estimatedCost: 210, isUrgent: true,  supplierName: 'LaticíniosBR' },
  { stockItemId: uid(), name: 'Leite Integral',    category: 'laticinios',      unit: 'L',       currentQty: 2,  minimumQty: 10, productionNeed: 8,  totalAvailable: 2,  toBuy: 16, estimatedCost: 83,  isUrgent: true,  supplierName: 'LaticíniosBR' },
  { stockItemId: uid(), name: 'Alface Americana',  category: 'hortifruti',      unit: 'unidade', currentQty: 3,  minimumQty: 5,  productionNeed: 2,  totalAvailable: 3,  toBuy: 4,  estimatedCost: 16,  isUrgent: false, supplierName: 'Hortifruti Central' },
  { stockItemId: uid(), name: 'Ovos Frescos',      category: 'laticinios',      unit: 'unidade', currentQty: 24, minimumQty: 30, productionNeed: 12, totalAvailable: 24, toBuy: 18, estimatedCost: 13,  isUrgent: false, supplierName: 'LaticíniosBR' },
  { stockItemId: uid(), name: 'Salmão Fresco',     category: 'carnes_e_peixes', unit: 'kg',      currentQty: 0,  minimumQty: 2,  productionNeed: 4,  totalAvailable: 0,  toBuy: 6,  estimatedCost: 534, isUrgent: true,  supplierName: 'PeixariaMar' },
];

const mockOrders: PurchaseListItemWithDetails[] = [
  { id: uid(), user_id: ownerId, stock_item_id: uid(), quantity: 5,  unit: 'kg',      status: 'ordered',  scheduled_date: '2026-04-11', unit_price: 42,    stock_item: { name: 'Manteiga sem Sal', unit: 'kg' },  supplier: { name: 'LaticíniosBR' } },
  { id: uid(), user_id: ownerId, stock_item_id: uid(), quantity: 16, unit: 'L',       status: 'pending',  scheduled_date: '2026-04-12', unit_price: 5.20,  stock_item: { name: 'Leite Integral',  unit: 'L' },   supplier: { name: 'LaticíniosBR' } },
  { id: uid(), user_id: ownerId, stock_item_id: uid(), quantity: 6,  unit: 'kg',      status: 'pending',  scheduled_date: '2026-04-12', unit_price: 89,    stock_item: { name: 'Salmão Fresco',   unit: 'kg' },  supplier: { name: 'PeixariaMar' } },
  { id: uid(), user_id: ownerId, stock_item_id: uid(), quantity: 20, unit: 'unidade', status: 'received', scheduled_date: '2026-04-09', unit_price: 0.75,  stock_item: { name: 'Ovos Frescos',    unit: 'un' },  supplier: { name: 'LaticíniosBR' } },
];

const STATUS_STYLE: Record<PurchaseStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  ordered:   'bg-blue-100 text-blue-700',
  received:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

export function PurchaseNeedsTable() {
  const [tab, setTab] = useState<'needs' | 'orders'>('needs');

  const urgentCount = useMemo(() => mockNeeds.filter(n => n.isUrgent).length, []);
  const totalEstimated = useMemo(
    () => PurchaseService.calcTotalEstimated(mockNeeds),
    []
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Itens para comprar"   value={mockNeeds.length}       color="text-gray-700" />
        <KPICard label="Urgentes"             value={urgentCount}            color="text-red-600" />
        <KPICard label="Total estimado"       value={`R$ ${totalEstimated.toFixed(2)}`} color="text-blue-700" big />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(['needs', 'orders'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors
              ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'needs' ? 'Necessidades' : 'Pedidos ativos'}
          </button>
        ))}
      </div>

      {tab === 'needs' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Item</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Disponível</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">A comprar</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Custo est.</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Fornecedor</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Prioridade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mockNeeds.map(item => (
                <tr key={item.stockItemId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{item.totalAvailable} {item.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">{item.toBuy} {item.unit}</td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">R$ {item.estimatedCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{item.supplierName ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {item.isUrgent
                      ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">🔴 Urgente</span>
                      : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Normal</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'orders' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Item</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Qtd.</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Fornecedor</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Previsão</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mockOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{order.stock_item?.name}</td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{order.quantity} {order.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">
                    {order.unit_price ? `R$ ${(order.quantity * order.unit_price).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{order.supplier?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{order.scheduled_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[order.status]}`}>
                      {PURCHASE_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, color, big }: { label: string; value: string | number; color: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-1 font-bold ${big ? 'text-2xl' : 'text-3xl'} ${color}`}>{value}</p>
    </div>
  );
}
