import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TechnicalSheet = Database['public']['Tables']['technical_sheets']['Row'];
type TechnicalSheetInsert = Database['public']['Tables']['technical_sheets']['Insert'];
type TechnicalSheetUpdate = Database['public']['Tables']['technical_sheets']['Update'];
type TechnicalSheetIngredient = Database['public']['Tables']['technical_sheet_ingredients']['Row'];
type ProductionType = 'insumo' | 'final';

export type { TechnicalSheet, TechnicalSheetInsert, TechnicalSheetUpdate, TechnicalSheetIngredient, ProductionType };

export interface TechnicalSheetWithIngredients extends TechnicalSheet {
  production_type: ProductionType;
  ingredients: (TechnicalSheetIngredient & {
    stock_item: { name: string; unit: string } | null;
    stage_id?: string | null;
  })[];
}

export function useTechnicalSheets() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: sheets = [], isLoading, error } = useQuery({
    queryKey: ['technical_sheets', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('technical_sheets')
        .select(`
          *,
          ingredients:technical_sheet_ingredients(
            *,
            stock_item:stock_items(name, unit)
          )
        `)
        .order('name');
      if (error) throw error;
      // Cast production_type since it's added via migration
      return (data || []).map(sheet => ({
        ...sheet,
        production_type: (sheet as any).production_type || 'final',
      })) as TechnicalSheetWithIngredients[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  const createSheet = useMutation({
    mutationFn: async (sheet: Omit<TechnicalSheetInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('technical_sheets')
        .insert({ ...sheet, user_id: ownerId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      toast.success('Ficha técnica criada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar ficha técnica: ${err.message}`);
    },
  });

  const updateSheet = useMutation({
    mutationFn: async ({ id, ...updates }: TechnicalSheetUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('technical_sheets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      toast.success('Ficha técnica atualizada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar ficha técnica: ${err.message}`);
    },
  });

  const deleteSheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('technical_sheets')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      toast.success('Ficha técnica excluída com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir ficha técnica: ${err.message}`);
    },
  });

  const addIngredient = useMutation({
    mutationFn: async (ingredient: Database['public']['Tables']['technical_sheet_ingredients']['Insert']) => {
      const { data, error } = await supabase
        .from('technical_sheet_ingredients')
        .insert(ingredient)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('technical_sheet_ingredients')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
    },
  });

  return {
    sheets,
    isLoading,
    isOwnerLoading,
    error,
    createSheet,
    updateSheet,
    deleteSheet,
    addIngredient,
    removeIngredient,
  };
}
