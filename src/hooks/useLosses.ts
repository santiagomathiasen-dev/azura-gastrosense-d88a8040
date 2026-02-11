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
    mutationFn: async (input: LossInput) => {
      if (!ownerId) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('losses').insert({
        user_id: ownerId,
        source_type: input.source_type,
        source_id: input.source_id,
        source_name: input.source_name,
        quantity: input.quantity,
        unit: input.unit,
        estimated_value: input.estimated_value || 0,
        notes: input.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['losses'] });
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
