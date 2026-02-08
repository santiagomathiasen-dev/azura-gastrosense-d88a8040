import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';

export interface StockRequest {
  id: string;
  user_id: string;
  stock_item_id: string;
  requested_quantity: number;
  delivered_quantity: number;
  status: 'pending' | 'partial' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  stock_item?: StockItem;
}

export function useStockRequests() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['stock_requests', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          *,
          stock_item:stock_items(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (StockRequest & { stock_item: StockItem })[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  // Get pending requests only
  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'partial');

  // Create a new stock request (and add to purchase list if stock insufficient)
  const createRequest = useMutation({
    mutationFn: async ({ stockItemId, quantity, notes }: { stockItemId: string; quantity: number; notes?: string }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // Check central stock availability
      const { data: centralItem, error: centralError } = await supabase
        .from('stock_items')
        .select('current_quantity, minimum_quantity, supplier_id')
        .eq('id', stockItemId)
        .single();
      if (centralError) throw centralError;

      const currentQty = Number(centralItem?.current_quantity || 0);
      const shortfall = quantity - currentQty;

      // Create the stock request
      const { error } = await supabase
        .from('stock_requests')
        .insert({
          user_id: ownerId,
          stock_item_id: stockItemId,
          requested_quantity: quantity,
          notes,
        });
      if (error) throw error;

      // If stock is insufficient, add shortfall to purchase list
      if (shortfall > 0) {
        // Check if item is already in purchase list (pending or ordered)
        const { data: existingPurchase } = await supabase
          .from('purchase_list_items')
          .select('id, suggested_quantity')
          .eq('stock_item_id', stockItemId)
          .in('status', ['pending', 'ordered'])
          .single();

        if (existingPurchase) {
          // Update existing purchase item to increase quantity
          await supabase
            .from('purchase_list_items')
            .update({ 
              suggested_quantity: Number(existingPurchase.suggested_quantity) + shortfall 
            })
            .eq('id', existingPurchase.id);
        } else {
          // Create new purchase list item
          await supabase
            .from('purchase_list_items')
            .insert({
              user_id: ownerId,
              stock_item_id: stockItemId,
              suggested_quantity: shortfall,
              supplier_id: centralItem?.supplier_id || null,
              status: 'pending',
            });
        }

        return { addedToPurchaseList: true, shortfall };
      }

      return { addedToPurchaseList: false, shortfall: 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      if (result?.addedToPurchaseList) {
        toast.success(`Solicitação criada! ${result.shortfall.toFixed(1)} adicionado à lista de compras (estoque insuficiente).`);
      } else {
        toast.success('Solicitação criada com sucesso!');
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar solicitação: ${err.message}`);
    },
  });

  // Fulfill a request (deliver items from central to production)
  const fulfillRequest = useMutation({
    mutationFn: async ({ requestId, deliverQuantity }: { requestId: string; deliverQuantity: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // Get the request
      const { data: request, error: fetchError } = await supabase
        .from('stock_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (fetchError) throw fetchError;
      if (!request) throw new Error('Solicitação não encontrada');

      // Check if central stock has enough
      const { data: centralItem, error: centralError } = await supabase
        .from('stock_items')
        .select('current_quantity')
        .eq('id', request.stock_item_id)
        .single();
      if (centralError) throw centralError;
      if (!centralItem || Number(centralItem.current_quantity) < deliverQuantity) {
        throw new Error('Quantidade insuficiente no estoque central');
      }

      // 1. Create exit movement from central stock
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          stock_item_id: request.stock_item_id,
          user_id: ownerId,
          type: 'exit',
          quantity: deliverQuantity,
          source: 'manual',
          notes: `Entrega de solicitação #${requestId.slice(0, 8)}`,
        });
      if (movementError) throw movementError;

      // 2. Add to production stock (upsert)
      const { data: existingProdStock } = await supabase
        .from('production_stock')
        .select('id, quantity')
        .eq('stock_item_id', request.stock_item_id)
        .single();

      if (existingProdStock) {
        const { error: updateError } = await supabase
          .from('production_stock')
          .update({ quantity: Number(existingProdStock.quantity) + deliverQuantity })
          .eq('id', existingProdStock.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('production_stock')
          .insert({
            user_id: ownerId,
            stock_item_id: request.stock_item_id,
            quantity: deliverQuantity,
          });
        if (insertError) throw insertError;
      }

      // 3. Record transfer
      const { error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          user_id: ownerId,
          stock_item_id: request.stock_item_id,
          quantity: deliverQuantity,
          direction: 'to_production',
          notes: `Entrega de solicitação #${requestId.slice(0, 8)}`,
        });
      if (transferError) throw transferError;

      // 4. Update request status
      const newDeliveredQty = Number(request.delivered_quantity) + deliverQuantity;
      const requestedQty = Number(request.requested_quantity);
      const newStatus = newDeliveredQty >= requestedQty ? 'completed' : 'partial';

      const { error: updateRequestError } = await supabase
        .from('stock_requests')
        .update({
          delivered_quantity: newDeliveredQty,
          status: newStatus,
        })
        .eq('id', requestId);
      if (updateRequestError) throw updateRequestError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
      toast.success('Solicitação atendida com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atender solicitação: ${err.message}`);
    },
  });

  // Cancel a request
  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('stock_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      toast.success('Solicitação cancelada');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });

  return {
    requests,
    pendingRequests,
    isLoading,
    isOwnerLoading,
    error,
    createRequest,
    fulfillRequest,
    cancelRequest,
  };
}
