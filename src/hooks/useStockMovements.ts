import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type StockMovement = Database['public']['Tables']['stock_movements']['Row'];
type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];
type MovementType = Database['public']['Enums']['movement_type'];
type MovementSource = Database['public']['Enums']['movement_source'];

export type { StockMovement, StockMovementInsert, MovementType, MovementSource };

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  adjustment: 'Ajuste',
};

export const MOVEMENT_SOURCE_LABELS: Record<MovementSource, string> = {
  manual: 'Manual',
  production: 'Produção',
  audio: 'Áudio',
  image: 'Imagem',
};

export function useStockMovements(stockItemId?: string) {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: movements = [], isLoading, error } = useQuery({
    queryKey: ['stock_movements', stockItemId, ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      let query = supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (stockItemId) {
        query = query.eq('stock_item_id', stockItemId);
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as StockMovement[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  const createMovement = useMutation({
    mutationFn: async (movement: Omit<StockMovementInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('stock_movements')
        .insert({ ...movement, user_id: ownerId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Movimentação registrada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar movimentação: ${err.message}`);
    },
  });

  return {
    movements,
    isLoading,
    isOwnerLoading,
    error,
    createMovement,
  };
}
