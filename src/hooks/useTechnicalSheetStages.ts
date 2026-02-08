import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface TechnicalSheetStage {
  id: string;
  technical_sheet_id: string;
  name: string;
  description: string | null;
  order_index: number;
  duration_minutes: number | null;
  created_at: string;
}

export interface TechnicalSheetStageStep {
  id: string;
  stage_id: string;
  description: string;
  order_index: number;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

export interface StageWithSteps extends TechnicalSheetStage {
  steps: TechnicalSheetStageStep[];
}

export function useTechnicalSheetStages(technicalSheetId?: string) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['technical_sheet_stages', technicalSheetId],
    queryFn: async () => {
      if (!technicalSheetId || (!user?.id && !ownerId)) return [];
      
      const { data, error } = await supabase
        .from('technical_sheet_stages')
        .select(`
          *,
          steps:technical_sheet_stage_steps(*)
        `)
        .eq('technical_sheet_id', technicalSheetId)
        .order('order_index');
      
      if (error) throw error;
      
      // Sort steps within each stage
      return (data || []).map(stage => ({
        ...stage,
        steps: (stage.steps || []).sort((a: TechnicalSheetStageStep, b: TechnicalSheetStageStep) => a.order_index - b.order_index)
      })) as StageWithSteps[];
    },
    enabled: !!technicalSheetId && (!!user?.id || !!ownerId),
  });

  const createStage = useMutation({
    mutationFn: async (stage: Omit<TechnicalSheetStage, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('technical_sheet_stages')
        .insert(stage)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar etapa: ${err.message}`);
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TechnicalSheetStage> & { id: string }) => {
      const { data, error } = await supabase
        .from('technical_sheet_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar etapa: ${err.message}`);
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('technical_sheet_stages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir etapa: ${err.message}`);
    },
  });

  const createStep = useMutation({
    mutationFn: async (step: Omit<TechnicalSheetStageStep, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('technical_sheet_stage_steps')
        .insert(step)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar passo: ${err.message}`);
    },
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TechnicalSheetStageStep> & { id: string }) => {
      const { data, error } = await supabase
        .from('technical_sheet_stage_steps')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar passo: ${err.message}`);
    },
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('technical_sheet_stage_steps')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir passo: ${err.message}`);
    },
  });

  return {
    stages,
    isLoading,
    createStage,
    updateStage,
    deleteStage,
    createStep,
    updateStep,
    deleteStep,
  };
}
