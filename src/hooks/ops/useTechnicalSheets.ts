import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../shared/useAuth';
import { useOwnerId } from '../shared/useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';
import { useDriveCollection } from '../shared/useDriveModule';
import { useDriveData } from '@/contexts/DriveDataContext';

import { technicalSheetApi } from '@/api/TechnicalSheetApi';
import { SheetCostsService } from '../../modules/technical-sheets/services/SheetCostsService';
import type {
  TechnicalSheet,
  TechnicalSheetInsert,
  TechnicalSheetUpdate,
  TechnicalSheetIngredient
} from '../../modules/technical-sheets/types';

type ProductionType = 'insumo' | 'final';

export type { TechnicalSheet, TechnicalSheetInsert, TechnicalSheetUpdate, TechnicalSheetIngredient, ProductionType };

export interface TechnicalSheetWithIngredients extends TechnicalSheet {
  production_type: ProductionType;
  minimum_stock: number;
  video_url: string | null;
  labor_cost: number;
  energy_cost: number;
  other_costs: number;
  markup: number;
  target_price: number | null;
  ingredients: (TechnicalSheetIngredient & {
    stock_item: { name: string; unit: string; unit_price: number | null } | null;
    stage_id?: string | null;
  })[];
}

/** Normalize raw sheet data (Drive or Supabase) into consistent shape */
function normalizeSheets(data: any[]): TechnicalSheetWithIngredients[] {
  return (data || []).map((sheet: any) => ({
    ...sheet,
    production_type: (sheet.production_type as ProductionType) || 'final',
    minimum_stock: Number(sheet.minimum_stock || 0),
    video_url: sheet.video_url || null,
    labor_cost: Number(sheet.labor_cost || 0),
    energy_cost: Number(sheet.energy_cost || 0),
    other_costs: Number(sheet.other_costs || 0),
    markup: Number(sheet.markup || 0),
    target_price: sheet.target_price || null,
    ingredients: sheet.ingredients || [],
  }));
}

export function useTechnicalSheets() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();
  const { isDriveConnected } = useDriveData();

  // Hybrid query: Drive or Supabase
  const {
    items: sheets,
    isLoading,
    error,
    create: createSheetMutation,
    update: updateSheetMutation,
    remove: deleteSheetMutation,
  } = useDriveCollection<TechnicalSheetWithIngredients>('recipes', 'technical_sheets', {
    supabaseFallback: () => technicalSheetApi.getAll() as Promise<any[]>,
    supabaseCreate: (item) => technicalSheetApi.create(item) as Promise<any>,
    supabaseUpdate: (id, updates) => technicalSheetApi.update(id, updates) as Promise<any>,
    supabaseDelete: (id) => technicalSheetApi.remove(id),
    transform: normalizeSheets,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 300_000,
  });

  // Wrap create to normalize cost fields
  const createSheet = useMutation({
    mutationFn: async (sheet: Omit<TechnicalSheetInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuario...');
      if (!ownerId) throw new Error('Usuario nao autenticado');

      const normalized = {
        ...sheet,
        user_id: ownerId,
        labor_cost: Number(sheet.labor_cost || 0),
        energy_cost: Number(sheet.energy_cost || 0),
        other_costs: Number(sheet.other_costs || 0),
        ingredients: [],
      };

      const created = await createSheetMutation.mutateAsync(normalized as any);

      // FASE 3: Dual-write — cria entrada em sheet_costs para a nova ficha
      if (created?.id) {
        try {
          await SheetCostsService.upsert({
            technical_sheet_id: created.id,
            user_id: ownerId,
            labor_cost:  Number(sheet.labor_cost  || 0),
            energy_cost: Number(sheet.energy_cost || 0),
            other_costs: Number(sheet.other_costs || 0),
            markup:      Number(sheet.markup      || 0),
            target_price: (sheet as any).target_price ?? null,
          }, Number(sheet.yield_quantity || 1));
        } catch (e) {
          // Não bloqueia o fluxo principal — sheet_costs será sincronizado na próxima edição
          console.warn('[SheetCosts] Falha ao criar sheet_costs para ficha', created.id, e);
        }
      }

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      queryClient.invalidateQueries({ queryKey: ['sheet_costs'] });
      toast.success('Ficha tecnica criada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar ficha tecnica: ${err.message}`);
    },
  });

  const FINANCIAL_FIELDS = new Set([
    'labor_cost', 'energy_cost', 'other_costs', 'markup', 'target_price',
    'total_cost', 'cost_per_unit',
  ]);

  const updateSheet = useMutation({
    mutationFn: async ({ id, ...updates }: TechnicalSheetUpdate & { id: string }) => {
      const normalized = {
        id,
        ...updates,
        labor_cost: updates.labor_cost !== undefined ? Number(updates.labor_cost || 0) : undefined,
        energy_cost: updates.energy_cost !== undefined ? Number(updates.energy_cost || 0) : undefined,
        other_costs: updates.other_costs !== undefined ? Number(updates.other_costs || 0) : undefined,
      };

      const result = await updateSheetMutation.mutateAsync(normalized as any);

      // FASE 3: Dual-write — sincroniza campos financeiros com sheet_costs
      const hasFinancialUpdate = Object.keys(updates).some(k => FINANCIAL_FIELDS.has(k));
      if (hasFinancialUpdate) {
        try {
          const sheet = sheets.find(s => s.id === id);
          const yieldQty = Number(updates.yield_quantity ?? sheet?.yield_quantity ?? 1);
          await SheetCostsService.update(
            id,
            {
              labor_cost:   updates.labor_cost  !== undefined ? Number(updates.labor_cost  || 0) : undefined,
              energy_cost:  updates.energy_cost !== undefined ? Number(updates.energy_cost || 0) : undefined,
              other_costs:  updates.other_costs !== undefined ? Number(updates.other_costs || 0) : undefined,
              markup:       updates.markup      !== undefined ? Number(updates.markup      || 0) : undefined,
              target_price: (updates as any).target_price,
            },
            yieldQty
          );
        } catch (e) {
          console.warn('[SheetCosts] Falha ao sincronizar sheet_costs para ficha', id, e);
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      queryClient.invalidateQueries({ queryKey: ['sheet_costs'] });
      toast.success('Ficha tecnica atualizada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar ficha tecnica: ${err.message}`);
    },
  });

  const deleteSheet = useMutation({
    mutationFn: async (id: string) => {
      return deleteSheetMutation.mutateAsync(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      toast.success('Ficha tecnica excluida com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir ficha tecnica: ${err.message}`);
    },
  });

  // Add ingredient — Drive mode manipulates nested array, Supabase uses REST
  const addIngredient = useMutation({
    mutationFn: async (ingredient: {
      technical_sheet_id: string;
      stock_item_id: string;
      quantity: number;
      unit: string;
      stage_id?: string | null;
    }) => {
      if (!ownerId) throw new Error('Usuario nao autenticado');

      // Supabase mode (also used when Drive not connected)
      const data = await supabaseFetch('technical_sheet_ingredients', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          technical_sheet_id: ingredient.technical_sheet_id,
          stock_item_id: ingredient.stock_item_id,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          stage_id: ingredient.stage_id || null,
        })
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`technical_sheet_ingredients?id=eq.${id}`, {
        method: 'DELETE'
      });
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
