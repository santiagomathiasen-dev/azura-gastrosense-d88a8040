import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type SaleComponentType = Database['public']['Enums']['sale_component_type'];

export interface SaleProductComponent {
  id: string;
  sale_product_id: string;
  component_type: SaleComponentType;
  component_id: string;
  quantity: number;
  unit: string;
  created_at: string;
  component_name?: string;
}

export interface SaleProduct {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sale_price: number | null;
  image_url: string | null;
  is_active: boolean;
  ready_quantity: number;
  minimum_stock: number;
  created_at: string;
  updated_at: string;
  components?: SaleProductComponent[];
}

export interface ComponentInput {
  component_type: SaleComponentType;
  component_id: string;
  quantity: number;
  unit: string;
}

export function useSaleProducts() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: saleProducts = [], isLoading, error } = useQuery({
    queryKey: ['sale_products', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      const { data, error } = await supabase
        .from('sale_products')
        .select(`
          *,
          components:sale_product_components(*)
        `)
        .order('name', { ascending: true });
      if (error) throw error;

      return (data || []).map(p => ({
        ...p,
        minimum_stock: Number(p.minimum_stock || 0),
        sale_price: p.sale_price ? Number(p.sale_price) : null,
      })) as SaleProduct[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  const createSaleProduct = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      sale_price?: number;
      image_url?: string;
      minimum_stock?: number;
      labor_cost?: number;
      energy_cost?: number;
      other_costs?: number;
      components: ComponentInput[];
    }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const { data: product, error: productError } = await supabase
        .from('sale_products')
        .insert({
          user_id: ownerId,
          name: data.name,
          description: data.description,
          sale_price: data.sale_price,
          image_url: data.image_url,
          minimum_stock: data.minimum_stock || 0,
        })
        .select()
        .single();
      if (productError) throw productError;

      if (data.components.length > 0) {
        const componentsToInsert = data.components.map(c => ({
          user_id: ownerId,
          sale_product_id: product.id,
          component_type: c.component_type,
          component_id: c.component_id,
          quantity: c.quantity,
          unit: c.unit,
        }));

        const { error: componentsError } = await supabase
          .from('sale_product_components')
          .insert(componentsToInsert);
        if (componentsError) throw componentsError;
      }

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Produto para venda criado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar produto: ${err.message}`);
    },
  });

  const updateSaleProduct = useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      sale_price?: number;
      image_url?: string;
      is_active?: boolean;
      minimum_stock?: number;
      labor_cost?: number;
      energy_cost?: number;
      other_costs?: number;
      components?: ComponentInput[];
    }) => {
      const { id, components, ...updates } = data;

      if (Object.keys(updates).length > 0) {
        // Filter out non-existent fields from updates to prevent DB errors
        const {
          labor_cost,
          energy_cost,
          other_costs,
          ...validUpdates
        } = updates as any;

        if (Object.keys(validUpdates).length > 0) {
          const { error } = await supabase
            .from('sale_products')
            .update(validUpdates)
            .eq('id', id);
          if (error) throw error;
        }
      }

      if (components !== undefined) {
        await supabase.from('sale_product_components').delete().eq('sale_product_id', id);

        if (components.length > 0) {
          const componentsToInsert = components.map(c => ({
            user_id: ownerId,
            sale_product_id: id,
            component_type: c.component_type,
            component_id: c.component_id,
            quantity: c.quantity,
            unit: c.unit,
          }));

          const { error: componentsError } = await supabase
            .from('sale_product_components')
            .insert(componentsToInsert);
          if (componentsError) throw componentsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Produto atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar produto: ${err.message}`);
    },
  });

  const deleteSaleProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sale_products')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Produto removido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover produto: ${err.message}`);
    },
  });

  // Prepare product - deduct components from stock and add 1 to ready_quantity
  const prepareSaleProduct = useMutation({
    mutationFn: async ({ sale_product_id, quantity = 1 }: { sale_product_id: string; quantity?: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      const insufficientItems: { id: string; name: string; type: SaleComponentType; amount: number }[] = [];

      // Process each component and deduct from appropriate stock (multiplied by quantity)
      for (const component of product.components || []) {
        const neededTotalQty = Number(component.quantity) * quantity;

        if (component.component_type === 'finished_production') {
          const { data: stock } = await supabase
            .from('finished_productions_stock')
            .select('id, quantity')
            .eq('technical_sheet_id', component.component_id)
            .maybeSingle();

          if (!stock || Number(stock.quantity) < neededTotalQty) {
            const { data: sheet } = await supabase
              .from('technical_sheets')
              .select('name')
              .eq('id', component.component_id)
              .single();

            insufficientItems.push({
              id: component.component_id,
              name: sheet?.name || 'Produção desconhecida',
              type: 'finished_production',
              amount: Math.max(0, neededTotalQty - (Number(stock?.quantity) || 0))
            });
            continue;
          }

          const newQty = Number(stock.quantity) - neededTotalQty;
          if (newQty <= 0) {
            const { error: deleteError } = await supabase
              .from('finished_productions_stock')
              .delete()
              .eq('id', stock.id);
            if (deleteError) throw deleteError;
          } else {
            const { error: updateError } = await supabase
              .from('finished_productions_stock')
              .update({ quantity: newQty })
              .eq('id', stock.id);
            if (updateError) throw updateError;
          }
        } else if (component.component_type === 'stock_item') {
          const { data: prodStock } = await supabase
            .from('production_stock')
            .select('id, quantity, stock_item:stock_items(name)')
            .eq('stock_item_id', component.component_id)
            .maybeSingle();

          if (!prodStock || Number(prodStock.quantity) < neededTotalQty) {
            const { data: stockItem } = await supabase
              .from('stock_items')
              .select('name')
              .eq('id', component.component_id)
              .single();

            insufficientItems.push({
              id: component.component_id,
              name: stockItem?.name || 'Item desconhecido',
              type: 'stock_item',
              amount: Math.max(0, neededTotalQty - (Number(prodStock?.quantity) || 0))
            });
            continue;
          }

          const newProdQty = Number(prodStock.quantity) - neededTotalQty;
          if (newProdQty <= 0) {
            const { error: deleteError } = await supabase
              .from('production_stock')
              .delete()
              .eq('id', prodStock.id);
            if (deleteError) throw deleteError;
          } else {
            const { error: updateError } = await supabase
              .from('production_stock')
              .update({ quantity: newProdQty })
              .eq('id', prodStock.id);
            if (updateError) throw updateError;
          }
        } else if (component.component_type === 'sale_product') {
          const { data: otherProduct } = await supabase
            .from('sale_products')
            .select('id, ready_quantity, name')
            .eq('id', component.component_id)
            .single();

          if (!otherProduct || Number(otherProduct.ready_quantity) < neededTotalQty) {
            insufficientItems.push({
              id: component.component_id,
              name: otherProduct?.name || 'Produto desconhecido',
              type: 'sale_product',
              amount: neededTotalQty - (Number(otherProduct?.ready_quantity) || 0)
            });
            continue;
          }

          const { error: updateError } = await supabase
            .from('sale_products')
            .update({ ready_quantity: Number(otherProduct.ready_quantity) - neededTotalQty })
            .eq('id', otherProduct.id);
          if (updateError) throw updateError;
        }
      }

      if (insufficientItems.length > 0) {
        // Record alerts in the database
        const alertsToInsert = insufficientItems.map(item => ({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          missing_component_id: item.id,
          missing_component_type: item.type,
          missing_quantity: item.amount,
          resolved: false,
        }));

        const { error: alertError } = await supabase
          .from('preparation_alerts')
          .insert(alertsToInsert);

        if (alertError) {
          console.error('Error recording preparation alerts:', alertError);
        } else {
          // Invalidate alerts query to update dashboard immediately
          queryClient.invalidateQueries({ queryKey: ['preparation_alerts'] });
        }

        const error = new Error(`Estoque insuficiente`);
        (error as any).insufficientItems = insufficientItems;
        throw error;
      }

      // Increment ready_quantity by the full amount
      const { error: finalUpdateError } = await supabase
        .from('sale_products')
        .update({ ready_quantity: (product.ready_quantity || 0) + quantity })
        .eq('id', sale_product_id);
      if (finalUpdateError) throw finalUpdateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      toast.success('Produto preparado! Estoque deduzido.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Quick sale - sell 1 unit from ready_quantity (no stock deduction, already done in prepare)
  const quickSale = useMutation({
    mutationFn: async (sale_product_id: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      if ((product.ready_quantity || 0) < 1) {
        throw new Error('Nenhum produto pronto para venda. Prepare primeiro!');
      }

      // Decrement ready_quantity
      const { error: updateError } = await supabase
        .from('sale_products')
        .update({ ready_quantity: product.ready_quantity - 1 })
        .eq('id', sale_product_id);
      if (updateError) throw updateError;

      // Record the sale
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          quantity_sold: 1,
        });
      if (saleError) throw saleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Venda registrada!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Return product - add 1 back to ready_quantity (components not restored)
  const returnProduct = useMutation({
    mutationFn: async (sale_product_id: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      // Increment ready_quantity (product returns to ready stock)
      const { error: updateError } = await supabase
        .from('sale_products')
        .update({ ready_quantity: (product.ready_quantity || 0) + 1 })
        .eq('id', sale_product_id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Devolução registrada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao devolver produto: ${err.message}`);
    },
  });

  // Register loss - remove 1 from ready_quantity without recording as sale
  const registerLoss = useMutation({
    mutationFn: async (sale_product_id: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      if ((product.ready_quantity || 0) < 1) {
        throw new Error('Nenhum produto pronto para registrar perda.');
      }

      // Decrement ready_quantity (loss)
      const { error: updateError } = await supabase
        .from('sale_products')
        .update({ ready_quantity: product.ready_quantity - 1 })
        .eq('id', sale_product_id);
      if (updateError) throw updateError;

      // Record the loss in the losses table
      const { error: lossError } = await supabase
        .from('losses')
        .insert({
          user_id: ownerId,
          source_type: 'sale_product',
          source_id: sale_product_id,
          source_name: product.name,
          quantity: 1,
          unit: 'unidade',
          estimated_value: product.sale_price || 0,
        });
      if (lossError) throw lossError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['losses'] });
      toast.success('Perda registrada!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Hot Station Sale - deduct components and immediately record sale (no ready_quantity used)
  const hotStationSale = useMutation({
    mutationFn: async ({ sale_product_id, quantity = 1 }: { sale_product_id: string; quantity?: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      const insufficientItems: { id: string; name: string; type: SaleComponentType; amount: number }[] = [];

      // Process each component and deduct from appropriate stock (multiplied by quantity)
      for (const component of product.components || []) {
        const neededTotalQty = Number(component.quantity) * quantity;

        if (component.component_type === 'finished_production') {
          const { data: stock } = await supabase
            .from('finished_productions_stock')
            .select('id, quantity')
            .eq('technical_sheet_id', component.component_id)
            .maybeSingle();

          if (!stock || Number(stock.quantity) < neededTotalQty) {
            const { data: sheet } = await supabase
              .from('technical_sheets')
              .select('name')
              .eq('id', component.component_id)
              .single();

            insufficientItems.push({
              id: component.component_id,
              name: sheet?.name || 'Produção desconhecida',
              type: 'finished_production',
              amount: Math.max(0, neededTotalQty - (Number(stock?.quantity) || 0))
            });
            continue;
          }

          const newQty = Number(stock.quantity) - neededTotalQty;
          if (newQty <= 0) {
            const { error: deleteError } = await supabase
              .from('finished_productions_stock')
              .delete()
              .eq('id', stock.id);
            if (deleteError) throw deleteError;
          } else {
            const { error: updateError } = await supabase
              .from('finished_productions_stock')
              .update({ quantity: newQty })
              .eq('id', stock.id);
            if (updateError) throw updateError;
          }
        } else if (component.component_type === 'stock_item') {
          const { data: prodStock } = await supabase
            .from('production_stock')
            .select('id, quantity, stock_item:stock_items(name)')
            .eq('stock_item_id', component.component_id)
            .maybeSingle();

          if (!prodStock || Number(prodStock.quantity) < neededTotalQty) {
            const { data: stockItem } = await supabase
              .from('stock_items')
              .select('name')
              .eq('id', component.component_id)
              .single();

            insufficientItems.push({
              id: component.component_id,
              name: stockItem?.name || 'Item desconhecido',
              type: 'stock_item',
              amount: Math.max(0, neededTotalQty - (Number(prodStock?.quantity) || 0))
            });
            continue;
          }

          const newProdQty = Number(prodStock.quantity) - neededTotalQty;
          if (newProdQty <= 0) {
            const { error: deleteError } = await supabase
              .from('production_stock')
              .delete()
              .eq('id', prodStock.id);
            if (deleteError) throw deleteError;
          } else {
            const { error: updateError } = await supabase
              .from('production_stock')
              .update({ quantity: newProdQty })
              .eq('id', prodStock.id);
            if (updateError) throw updateError;
          }
        } else if (component.component_type === 'sale_product') {
          const { data: otherProduct } = await supabase
            .from('sale_products')
            .select('id, ready_quantity, name')
            .eq('id', component.component_id)
            .single();

          if (!otherProduct || Number(otherProduct.ready_quantity) < neededTotalQty) {
            insufficientItems.push({
              id: component.component_id,
              name: otherProduct?.name || 'Produto desconhecido',
              type: 'sale_product',
              amount: neededTotalQty - (Number(otherProduct?.ready_quantity) || 0)
            });
            continue;
          }

          const { error: updateError } = await supabase
            .from('sale_products')
            .update({ ready_quantity: Number(otherProduct.ready_quantity) - neededTotalQty })
            .eq('id', otherProduct.id);
          if (updateError) throw updateError;
        }
      }

      if (insufficientItems.length > 0) {
        // Record alerts
        const alertsToInsert = insufficientItems.map(item => ({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          missing_component_id: item.id,
          missing_component_type: item.type,
          missing_quantity: item.amount,
          resolved: false,
        }));
        await supabase.from('preparation_alerts').insert(alertsToInsert);
        queryClient.invalidateQueries({ queryKey: ['preparation_alerts'] });

        const error = new Error(`Estoque insuficiente`);
        (error as any).insufficientItems = insufficientItems;
        throw error;
      }

      // Record Sale Directly
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          quantity_sold: quantity,
        });
      if (saleError) throw saleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Produzido e vendido com sucesso (Praça Quente)!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    saleProducts,
    isLoading,
    isOwnerLoading,
    error,
    createSaleProduct,
    updateSaleProduct,
    deleteSaleProduct,
    prepareSaleProduct,
    quickSale,
    returnProduct,
    registerLoss,
    hotStationSale,
  };
}
