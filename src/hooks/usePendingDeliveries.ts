import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PurchaseListItem = Database['public']['Tables']['purchase_list_items']['Row'];

export interface PendingDeliveryItem extends PurchaseListItem {
  stock_item: { name: string; unit: string; category: string } | null;
  supplier: { name: string } | null;
}

export function usePendingDeliveries() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: pendingItems = [], isLoading, error } = useQuery({
    queryKey: ['pending_deliveries', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('purchase_list_items')
        .select(`
          *,
          stock_item:stock_items(name, unit, category),
          supplier:suppliers(name)
        `)
        .eq('status', 'ordered')
        .order('order_date', { ascending: false });
      if (error) throw error;
      return data as PendingDeliveryItem[];
    },
    enabled: !!user?.id || !!ownerId,
  });

  // Mark an item as "ordered" with quantity (from Compras page)
  const markAsOrdered = useMutation({
    mutationFn: async ({ 
      stockItemId, 
      orderedQuantity,
      supplierId,
      suggestedQuantity,
      expectedDeliveryDate 
    }: { 
      stockItemId: string; 
      orderedQuantity: number;
      supplierId?: string | null;
      suggestedQuantity: number;
      expectedDeliveryDate?: string;
    }) => {
      if (!ownerId) throw new Error('Usuário não autenticado');
      
      // Create or update purchase list item with "ordered" status
      const { data: existing } = await supabase
        .from('purchase_list_items')
        .select('id')
        .eq('stock_item_id', stockItemId)
        .eq('status', 'ordered')
        .single();

      if (existing) {
        // Update existing ordered item
        const { error } = await supabase
          .from('purchase_list_items')
          .update({
            ordered_quantity: orderedQuantity,
            order_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: expectedDeliveryDate || null,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create new ordered item
        const { error } = await supabase
          .from('purchase_list_items')
          .insert({
            user_id: ownerId,
            stock_item_id: stockItemId,
            suggested_quantity: suggestedQuantity,
            ordered_quantity: orderedQuantity,
            supplier_id: supplierId || null,
            status: 'ordered',
            order_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: expectedDeliveryDate || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Compra registrada! Aguardando entrada no estoque.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar compra: ${err.message}`);
    },
  });

  // Confirm delivery and add to stock (entry movement)
  const confirmDelivery = useMutation({
    mutationFn: async ({ 
      itemId, 
      receivedQuantity,
      stockItemId
    }: { 
      itemId: string; 
      receivedQuantity: number;
      stockItemId: string;
    }) => {
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Create entry movement for stock
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          stock_item_id: stockItemId,
          user_id: ownerId,
          type: 'entry',
          quantity: receivedQuantity,
          source: 'manual',
          notes: 'Entrada de compra',
        });
      if (movementError) throw movementError;

      // 2. Mark purchase item as delivered
      const { error: updateError } = await supabase
        .from('purchase_list_items')
        .update({
          status: 'delivered',
          actual_delivery_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', itemId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      toast.success('Entrada no estoque registrada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao confirmar entrada: ${err.message}`);
    },
  });

  // Cancel pending order
  const cancelOrder = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('purchase_list_items')
        .update({ status: 'cancelled' })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Pedido cancelado.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });

  return {
    pendingItems,
    isLoading,
    error,
    markAsOrdered,
    confirmDelivery,
    cancelOrder,
  };
}
