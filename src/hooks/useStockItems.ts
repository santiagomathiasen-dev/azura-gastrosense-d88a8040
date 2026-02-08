import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type StockItem = Database['public']['Tables']['stock_items']['Row'];
type StockItemInsert = Database['public']['Tables']['stock_items']['Insert'];
type StockItemUpdate = Database['public']['Tables']['stock_items']['Update'];
type StockCategory = Database['public']['Enums']['stock_category'];
type StockUnit = Database['public']['Enums']['stock_unit'];

export type { StockItem, StockItemInsert, StockItemUpdate, StockCategory, StockUnit };

export const CATEGORY_LABELS: Record<StockCategory, string> = {
  laticinios: 'Laticínios',
  secos_e_graos: 'Secos e Grãos',
  hortifruti: 'Hortifruti',
  carnes_e_peixes: 'Carnes e Peixes',
  embalagens: 'Embalagens',
  limpeza: 'Limpeza',
  outros: 'Outros',
};

export const UNIT_LABELS: Record<StockUnit, string> = {
  kg: 'kg',
  g: 'g',
  L: 'L',
  ml: 'ml',
  unidade: 'un',
  caixa: 'cx',
  dz: 'dz',
};

export function getStockStatus(currentQty: number, minimumQty: number): 'green' | 'yellow' | 'red' {
  if (currentQty <= minimumQty) return 'red';
  if (currentQty <= minimumQty * 1.2) return 'yellow';
  return 'green';
}

export function useStockItems() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  // RLS policies use can_access_owner_data() which handles gestor/collaborator access
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['stock_items', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as StockItem[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<StockItemInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('stock_items')
        .insert({ ...item, user_id: ownerId });
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar item: ${err.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: StockItemUpdate & { id: string }) => {
      const { error } = await supabase
        .from('stock_items')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item atualizado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar item: ${err.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stock_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item excluído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir item: ${err.message}`);
    },
  });

  const itemsInAlert = items.filter(
    (item) => getStockStatus(Number(item.current_quantity), Number(item.minimum_quantity)) !== 'green'
  );

  return {
    items,
    isLoading,
    isOwnerLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
    itemsInAlert,
  };
}
