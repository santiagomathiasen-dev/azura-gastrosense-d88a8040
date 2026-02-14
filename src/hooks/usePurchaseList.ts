import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PurchaseListItem = Database['public']['Tables']['purchase_list_items']['Row'];
type PurchaseListItemInsert = Database['public']['Tables']['purchase_list_items']['Insert'];
type PurchaseListItemUpdate = Database['public']['Tables']['purchase_list_items']['Update'];
type PurchaseStatus = Database['public']['Enums']['purchase_status'];

export type { PurchaseListItem, PurchaseListItemInsert, PurchaseListItemUpdate, PurchaseStatus };

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: 'Pendente',
  ordered: 'Pedido Feito',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export interface PurchaseListItemWithDetails extends PurchaseListItem {
  stock_item: { name: string; unit: string; category: string } | null;
  supplier: { name: string } | null;
}

export function usePurchaseList() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['purchase_list_items', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('purchase_list_items')
        .select(`
          *,
          stock_item:stock_items(name, unit, category),
          supplier:suppliers(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PurchaseListItemWithDetails[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<PurchaseListItemInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('purchase_list_items')
        .insert({ ...item, user_id: ownerId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Item adicionado à lista de compras!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar item: ${err.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: PurchaseListItemUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('purchase_list_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Item atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar item: ${err.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('purchase_list_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Item removido da lista!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover item: ${err.message}`);
    },
  });

  const pendingItems = items.filter((item) => item.status === 'pending');
  const orderedItems = items.filter((item) => item.status === 'ordered');

  return {
    items,
    pendingItems,
    orderedItems,
    isLoading,
    isOwnerLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
  };
}
