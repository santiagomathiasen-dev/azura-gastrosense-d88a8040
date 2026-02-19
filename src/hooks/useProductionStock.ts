import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';

interface ProductionStockItem {
  id: string;
  user_id: string;
  stock_item_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  stock_item?: StockItem;
}

interface StockTransfer {
  id: string;
  user_id: string;
  stock_item_id: string;
  quantity: number;
  direction: 'to_production' | 'to_central';
  notes: string | null;
  created_at: string;
}

export type { ProductionStockItem, StockTransfer };

export function useProductionStock() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: productionStock = [], isLoading, error } = useQuery({
    queryKey: ['production_stock', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('production_stock')
        .select(`
          *,
          stock_item:stock_items(*)
        `);
      if (error) throw error;
      return data as (ProductionStockItem & { stock_item: StockItem })[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  // Fetch transfer history
  const { data: transfers = [] } = useQuery({
    queryKey: ['stock_transfers', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          stock_item:stock_items(name, unit)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as (StockTransfer & { stock_item: { name: string; unit: string } })[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  // Transfer from central to production stock
  const transferToProduction = useMutation({
    mutationFn: async ({ stockItemId, quantity, notes }: { stockItemId: string; quantity: number; notes?: string }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Subtract from central stock (create exit movement)
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          stock_item_id: stockItemId,
          user_id: ownerId,
          type: 'exit',
          quantity,
          source: 'manual',
          notes: notes || 'Transferência para estoque de produção',
        });
      if (movementError) throw movementError;

      // 1b. Deduct from expiry batches (FIFO)
      const { data: batches } = await supabase
        .from('item_expiry_dates' as any)
        .select('*')
        .eq('stock_item_id', stockItemId)
        .gt('quantity', 0)
        .order('expiry_date', { ascending: true });

      if (batches && batches.length > 0) {
        let remaining = quantity;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, Number((batch as any).quantity));
          const newQty = Number((batch as any).quantity) - take;

          await supabase
            .from('item_expiry_dates' as any)
            .update({ quantity: newQty } as any)
            .eq('id', (batch as any).id);

          remaining -= take;
        }
      }

      // 2. Add to production stock (upsert)
      const { data: existing } = await supabase
        .from('production_stock')
        .select('id, quantity')
        .eq('stock_item_id', stockItemId)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from('production_stock')
          .update({ quantity: Number(existing.quantity) + quantity })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('production_stock')
          .insert({
            user_id: ownerId,
            stock_item_id: stockItemId,
            quantity,
          });
        if (insertError) throw insertError;
      }

      // 3. Record transfer
      const { error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          user_id: ownerId,
          stock_item_id: stockItemId,
          quantity,
          direction: 'to_production',
          notes,
        });
      if (transferError) throw transferError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
      toast.success('Transferido para estoque de produção!');
    },
    onError: (err: Error) => {
      toast.error(`Erro na transferência: ${err.message}`);
    },
  });

  // Transfer from production back to central stock
  const transferToCentral = useMutation({
    mutationFn: async ({ stockItemId, quantity, notes }: { stockItemId: string; quantity: number; notes?: string }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Check if we have enough in production stock
      const { data: prodStock } = await supabase
        .from('production_stock')
        .select('id, quantity')
        .eq('stock_item_id', stockItemId)
        .single();

      if (!prodStock || Number(prodStock.quantity) < quantity) {
        throw new Error('Quantidade insuficiente no estoque de produção');
      }

      // 2. Subtract from production stock
      const newQty = Number(prodStock.quantity) - quantity;
      if (newQty === 0) {
        const { error: deleteError } = await supabase
          .from('production_stock')
          .delete()
          .eq('id', prodStock.id);
        if (deleteError) throw deleteError;
      } else {
        const { error: updateError } = await supabase
          .from('production_stock')
          .update({ quantity: newQty })
          .eq('id', prodStock.id);
        if (updateError) throw updateError;
      }

      // 3. Add to central stock (create entry movement)
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          stock_item_id: stockItemId,
          user_id: ownerId,
          type: 'entry',
          quantity,
          source: 'manual',
          notes: notes || 'Devolução do estoque de produção',
        });
      if (movementError) throw movementError;

      // 4. Record transfer
      const { error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          user_id: ownerId,
          stock_item_id: stockItemId,
          quantity,
          direction: 'to_central',
          notes,
        });
      if (transferError) throw transferError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
      toast.success('Devolvido para estoque central!');
    },
    onError: (err: Error) => {
      toast.error(`Erro na devolução: ${err.message}`);
    },
  });

  // Use production stock for production (subtract quantity)
  const useFromProductionStock = useMutation({
    mutationFn: async ({ stockItemId, quantity }: { stockItemId: string; quantity: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const { data: prodStock } = await supabase
        .from('production_stock')
        .select('id, quantity')
        .eq('stock_item_id', stockItemId)
        .single();

      if (!prodStock) return 0; // Return 0 if item not in production stock

      const available = Number(prodStock.quantity);
      const toUse = Math.min(available, quantity);
      const newQty = available - toUse;

      if (newQty === 0) {
        await supabase.from('production_stock').delete().eq('id', prodStock.id);
      } else {
        await supabase.from('production_stock').update({ quantity: newQty }).eq('id', prodStock.id);
      }

      return toUse;
    },
  });

  // Get quantity available in production stock for a specific item
  const getProductionStockQuantity = (stockItemId: string): number => {
    const item = productionStock.find(ps => ps.stock_item_id === stockItemId);
    return item ? Number(item.quantity) : 0;
  };

  // Update production stock quantity directly (for voice input / inventory count)
  const updateQuantity = useMutation({
    mutationFn: async ({ stockItemId, quantity }: { stockItemId: string; quantity: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const { data: existing } = await supabase
        .from('production_stock')
        .select('id, quantity')
        .eq('stock_item_id', stockItemId)
        .single();

      if (existing) {
        if (quantity === 0) {
          const { error } = await supabase
            .from('production_stock')
            .delete()
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('production_stock')
            .update({ quantity })
            .eq('id', existing.id);
          if (error) throw error;
        }
      } else if (quantity > 0) {
        const { error } = await supabase
          .from('production_stock')
          .insert({
            user_id: ownerId,
            stock_item_id: stockItemId,
            quantity,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar quantidade: ${err.message}`);
    },
  });

  return {
    productionStock,
    transfers,
    isLoading,
    isOwnerLoading,
    error,
    transferToProduction,
    transferToCentral,
    useFromProductionStock,
    getProductionStockQuantity,
    updateQuantity,
  };
}
