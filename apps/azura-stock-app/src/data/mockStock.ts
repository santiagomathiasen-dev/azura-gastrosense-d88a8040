// ---------------------------------------------------------------------------
// Dados de exemplo — substitua pela chamada real ao Supabase quando integrar.
// Todos os campos seguem exatamente o tipo StockItem do @azura/stock.
// ---------------------------------------------------------------------------
import type { StockItem } from '@azura/stock';

const uid = () => crypto.randomUUID();
const ownerId = '00000000-0000-0000-0000-000000000001';

export const mockStockItems: StockItem[] = [
  {
    id: uid(), user_id: ownerId,
    name: 'Farinha de Trigo T55',
    current_quantity: 18,  minimum_quantity: 5,
    unit: 'kg',   category: 'secos_e_graos',
    unit_price: 4.50,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Leite Integral UHT',
    current_quantity: 2,   minimum_quantity: 10,
    unit: 'L',    category: 'laticinios',
    unit_price: 5.20,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Ovos Frescos',
    current_quantity: 24,  minimum_quantity: 30,
    unit: 'unidade', category: 'laticinios',
    unit_price: 0.75,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Manteiga sem Sal',
    current_quantity: 0,   minimum_quantity: 2,
    unit: 'kg',   category: 'laticinios',
    unit_price: 42.00,
    is_expired: false,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Açúcar Refinado',
    current_quantity: 12,  minimum_quantity: 3,
    unit: 'kg',   category: 'secos_e_graos',
    unit_price: 3.80,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Alface Americana',
    current_quantity: 3,   minimum_quantity: 5,
    unit: 'unidade', category: 'hortifruti',
    unit_price: 4.00,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Frango (Peito)',
    current_quantity: 8,   minimum_quantity: 4,
    unit: 'kg',   category: 'carnes_e_peixes',
    unit_price: 22.00,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Salmão Fresco',
    current_quantity: 0,   minimum_quantity: 2,
    unit: 'kg',   category: 'carnes_e_peixes',
    unit_price: 89.00,
    is_expired: true,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Azeite Extra Virgem',
    current_quantity: 5,   minimum_quantity: 2,
    unit: 'L',    category: 'secos_e_graos',
    unit_price: 38.00,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Embalagem Kraft 500ml',
    current_quantity: 200, minimum_quantity: 50,
    unit: 'unidade', category: 'embalagens',
    unit_price: 0.45,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Detergente Neutro',
    current_quantity: 4,   minimum_quantity: 2,
    unit: 'L',    category: 'limpeza',
    unit_price: 8.50,
  },
  {
    id: uid(), user_id: ownerId,
    name: 'Tomate Italiano',
    current_quantity: 6,   minimum_quantity: 3,
    unit: 'kg',   category: 'hortifruti',
    unit_price: 7.00,
  },
];
