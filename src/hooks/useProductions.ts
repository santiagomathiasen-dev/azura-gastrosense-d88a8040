import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Production = Database['public']['Tables']['productions']['Row'];
type ProductionInsert = Database['public']['Tables']['productions']['Insert'];
type ProductionUpdate = Database['public']['Tables']['productions']['Update'];
type ProductionStatus = Database['public']['Enums']['production_status'];
type ProductionPeriod = Database['public']['Enums']['production_period'];

export type { Production, ProductionInsert, ProductionUpdate, ProductionStatus, ProductionPeriod };

export const STATUS_LABELS: Record<ProductionStatus, string> = {
  planned: 'Planejada',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export const PERIOD_LABELS: Record<ProductionPeriod, string> = {
  day: 'Diária',
  week: 'Semanal',
  month: 'Mensal',
  year: 'Anual',
  custom: 'Personalizada',
};

export interface ProductionWithSheet extends Production {
  technical_sheet: {
    id: string;
    name: string;
    yield_quantity: number;
    yield_unit: string;
    ingredients: {
      stock_item_id: string;
      quantity: number;
      unit: string;
      stock_item: { name: string } | null;
    }[];
  } | null;
}

export function useProductions() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: productions = [], isLoading, error } = useQuery({
    queryKey: ['productions', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          technical_sheet:technical_sheets(
            id,
            name,
            yield_quantity,
            yield_unit,
            ingredients:technical_sheet_ingredients(
              stock_item_id,
              quantity,
              unit,
              stock_item:stock_items(name)
            )
          )
        `)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data as ProductionWithSheet[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  const createProduction = useMutation({
    mutationFn: async (production: Omit<ProductionInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('productions')
        .insert({ ...production, user_id: ownerId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      toast.success('Produção criada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar produção: ${err.message}`);
    },
  });

  // Function to subtract stock when production starts
  // Priority: 1. Production Stock → 2. Central Stock → 3. Generate purchase order
  const subtractStockForProduction = async (production: ProductionWithSheet) => {
    if (!ownerId || !production.technical_sheet) return;

    const yieldQty = Number(production.technical_sheet.yield_quantity);
    const plannedQty = Number(production.planned_quantity);
    const multiplier = plannedQty / yieldQty;

    const insufficientItems: { name: string; needed: number; available: number; unit: string }[] = [];

    for (const ingredient of production.technical_sheet.ingredients) {
      const stockItemId = ingredient.stock_item_id;
      // Apply waste factor from stock item
      const wasteFactorResult = await supabase
        .from('stock_items')
        .select('waste_factor, current_quantity, name, unit')
        .eq('id', stockItemId)
        .single();
      
      const wasteFactor = Number(wasteFactorResult.data?.waste_factor || 0) / 100;
      const baseQty = Number(ingredient.quantity) * multiplier;
      const neededQty = baseQty * (1 + wasteFactor); // Apply waste factor
      
      let remainingQty = neededQty;

      // 1. First, try to use from production stock
      const { data: prodStock } = await supabase
        .from('production_stock')
        .select('id, quantity')
        .eq('stock_item_id', stockItemId)
        .single();

      if (prodStock && Number(prodStock.quantity) > 0) {
        const useFromProd = Math.min(Number(prodStock.quantity), remainingQty);
        const newProdQty = Number(prodStock.quantity) - useFromProd;
        
        if (newProdQty <= 0) {
          await supabase.from('production_stock').delete().eq('id', prodStock.id);
        } else {
          await supabase.from('production_stock').update({ quantity: newProdQty }).eq('id', prodStock.id);
        }
        
        remainingQty -= useFromProd;
      }

      // 2. If still need more, use from central stock
      if (remainingQty > 0) {
        const centralQty = Number(wasteFactorResult.data?.current_quantity || 0);
        
        if (centralQty > 0) {
          const useFromCentral = Math.min(centralQty, remainingQty);
          
          // Create exit movement from central stock
          await supabase.from('stock_movements').insert({
            stock_item_id: stockItemId,
            user_id: ownerId,
            type: 'exit',
            quantity: useFromCentral,
            source: 'production',
            related_production_id: production.id,
            notes: `Baixa automática - Produção: ${production.name}`,
          });
          
          remainingQty -= useFromCentral;
        }
      }

      // 3. If still insufficient, track for purchase order
      if (remainingQty > 0) {
        insufficientItems.push({
          name: wasteFactorResult.data?.name || ingredient.stock_item?.name || 'Item',
          needed: neededQty,
          available: (Number(prodStock?.quantity || 0) + Number(wasteFactorResult.data?.current_quantity || 0)),
          unit: wasteFactorResult.data?.unit || ingredient.unit,
        });

        // Auto-generate purchase order for missing quantity
        // Check if item already exists in purchase list
        const { data: existingPurchase } = await supabase
          .from('purchase_list_items')
          .select('id, suggested_quantity')
          .eq('stock_item_id', stockItemId)
          .eq('status', 'pending')
          .single();

        if (existingPurchase) {
          // Update existing purchase item
          await supabase
            .from('purchase_list_items')
            .update({ 
              suggested_quantity: Number(existingPurchase.suggested_quantity) + remainingQty 
            })
            .eq('id', existingPurchase.id);
        } else {
          // Create new purchase item
          await supabase.from('purchase_list_items').insert({
            user_id: ownerId,
            stock_item_id: stockItemId,
            suggested_quantity: remainingQty,
            status: 'pending',
            notes: `Gerado automaticamente - Produção: ${production.name}`,
          });
        }
      }
    }

    // Show warning if some items were insufficient
    if (insufficientItems.length > 0) {
      const itemsList = insufficientItems.map(i => `${i.name} (falta ${(i.needed - i.available).toFixed(2)} ${i.unit})`).join(', ');
      toast.warning(`Estoque insuficiente para: ${itemsList}. Pedidos de compra gerados automaticamente.`);
    }
  };

  // Function to add to finished productions stock when production is completed
  const addToFinishedStock = async (production: ProductionWithSheet, actualQuantity: number) => {
    if (!ownerId || !production.technical_sheet) return;

    const technicalSheetId = production.technical_sheet.id;
    const unit = production.technical_sheet.yield_unit;

    // Check if entry already exists for this technical sheet
    const { data: existing } = await supabase
      .from('finished_productions_stock')
      .select('id, quantity')
      .eq('technical_sheet_id', technicalSheetId)
      .single();

    if (existing) {
      // Update existing entry
      await supabase
        .from('finished_productions_stock')
        .update({ 
          quantity: Number(existing.quantity) + actualQuantity,
        })
        .eq('id', existing.id);
    } else {
      // Create new entry
      await supabase
        .from('finished_productions_stock')
        .insert({
          user_id: ownerId,
          technical_sheet_id: technicalSheetId,
          quantity: actualQuantity,
          unit: unit,
          notes: `Produção: ${production.name}`,
        });
    }
  };

  const updateProduction = useMutation({
    mutationFn: async ({ id, ...updates }: ProductionUpdate & { id: string }) => {
      // Get the current production to check status change
      const currentProduction = productions.find(p => p.id === id);
      
      const { data, error } = await supabase
        .from('productions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // If changing from 'planned' to 'in_progress', subtract stock
      if (
        currentProduction?.status === 'planned' &&
        updates.status === 'in_progress' &&
        currentProduction.technical_sheet
      ) {
        await subtractStockForProduction(currentProduction);
      }

      // If changing to 'completed', add to finished productions stock
      if (
        currentProduction?.status === 'in_progress' &&
        updates.status === 'completed' &&
        currentProduction.technical_sheet
      ) {
        const actualQty = updates.actual_quantity || currentProduction.planned_quantity;
        await addToFinishedStock(currentProduction, Number(actualQty));
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      
      if (variables.status === 'in_progress') {
        toast.success('Produção iniciada! Estoque atualizado automaticamente.');
      } else if (variables.status === 'completed') {
        toast.success('Produção finalizada! Adicionada ao estoque de produções finalizadas.');
      } else {
        toast.success('Produção atualizada com sucesso!');
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar produção: ${err.message}`);
    },
  });

  const deleteProduction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('productions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      toast.success('Produção excluída com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir produção: ${err.message}`);
    },
  });

  // Calculate projected stock consumption for planned productions
  const plannedProductions = productions.filter((p) => p.status === 'planned');

  const getProjectedConsumption = (stockItemId: string): number => {
    let totalConsumption = 0;
    for (const production of plannedProductions) {
      if (!production.technical_sheet) continue;
      const yieldQty = Number(production.technical_sheet.yield_quantity);
      const plannedQty = Number(production.planned_quantity);
      const multiplier = plannedQty / yieldQty;

      for (const ingredient of production.technical_sheet.ingredients) {
        if (ingredient.stock_item_id === stockItemId) {
          totalConsumption += Number(ingredient.quantity) * multiplier;
        }
      }
    }
    return totalConsumption;
  };

  return {
    productions,
    plannedProductions,
    isLoading,
    isOwnerLoading,
    error,
    createProduction,
    updateProduction,
    deleteProduction,
    getProjectedConsumption,
  };
}
