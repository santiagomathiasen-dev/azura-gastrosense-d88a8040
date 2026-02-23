import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface Loss {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  source_name: string;
  quantity: number;
  unit: string;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
}

export interface LossInput {
  source_type: string;
  source_id: string;
  source_name: string;
  quantity: number;
  unit: string;
  estimated_value?: number;
  notes?: string;
}

export function useLosses() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();

  const { data: losses = [], isLoading } = useQuery({
    queryKey: ['losses', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('losses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Loss[];
    },
    enabled: !!user?.id || !!ownerId,
  });

  const createLoss = useMutation({
    mutationFn: async (input: LossInput & { deductStock?: boolean }) => {
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Register the loss in the unified losses table
      const { data: lossData, error: lossError } = await supabase.from('losses').insert({
        user_id: ownerId,
        source_type: input.source_type,
        source_id: input.source_id,
        source_name: input.source_name,
        quantity: input.quantity,
        unit: input.unit,
        estimated_value: input.estimated_value || 0,
        notes: input.notes || null,
      }).select().single();

      if (lossError) throw lossError;

      // 2. If flag is set, deduct from stock and record movement
      if (input.deductStock) {
        if (input.source_type === 'stock_item') {
          // A. Fetch current stock item to get current qty
          const { data: item } = await supabase
            .from('stock_items')
            .select('current_quantity')
            .eq('id', input.source_id)
            .single();

          if (item) {
            const newQty = Math.max(0, Number(item.current_quantity) - input.quantity);

            // B. Update stock_item quantity
            await supabase
              .from('stock_items')
              .update({ current_quantity: newQty })
              .eq('id', input.source_id);

            // C. Register stock movement for audit
            await supabase
              .from('stock_movements')
              .insert({
                user_id: ownerId,
                stock_item_id: input.source_id,
                quantity: input.quantity,
                type: 'exit',
                source: 'manual',
                notes: `Perda registrada: ${input.notes || 'Sem observação'}`,
              });
          }
        } else if (input.source_type === 'finished_production') {
          // Fetch current stock
          const { data: stock } = await supabase
            .from('finished_productions_stock')
            .select('quantity')
            .eq('id', input.source_id)
            .single();

          if (stock) {
            const newQty = Math.max(0, Number(stock.quantity) - input.quantity);
            await supabase
              .from('finished_productions_stock')
              .update({ quantity: newQty })
              .eq('id', input.source_id);
          }
        }
      }

      return lossData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['losses'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      toast.success('Perda registrada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar perda: ${err.message}`);
    },
  });

  const deleteLoss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('losses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['losses'] });
      toast.success('Perda removida!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover perda: ${err.message}`);
    },
  });

  return { losses, isLoading, createLoss, deleteLoss };
}
