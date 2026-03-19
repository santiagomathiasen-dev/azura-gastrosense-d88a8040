import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

import { StockService } from '../modules/stock/services/StockService';
import { stockApi } from '@/api/StockApi';
import type {
  StockItem,
  StockItemInsert,
  StockItemUpdate,
  StockCategory,
  StockUnit
} from '../modules/stock/types';
import { CATEGORY_LABELS, UNIT_LABELS } from '../modules/stock/types';

export type { StockItem, StockItemInsert, StockItemUpdate, StockCategory, StockUnit };
export { CATEGORY_LABELS, UNIT_LABELS };

const EMPTY_ARRAY: any[] = [];

export function useStockItems() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  // RLS policies use can_access_owner_data() which handles gestor/collaborator access
  const { data: items = EMPTY_ARRAY, isLoading, error } = useQuery({
    queryKey: ['stock_items', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      return stockApi.getAll(ownerId || user?.id || '');
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    refetchInterval: 30_000,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<StockItemInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      return stockApi.create({ ...item, user_id: ownerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar item: ${err.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: StockItemUpdate & { id: string }) => {
      return stockApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item atualizado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar item: ${err.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await stockApi.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item excluído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir item: ${err.message}`);
    },
  });

  const itemsInAlert = StockService.getItemsInAlert(items);

  const batchCreateItems = useMutation({
    mutationFn: async (items: Omit<StockItemInsert, 'user_id'>[]) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const itemsWithUser = items.map(item => ({ ...item, user_id: ownerId }));

      try {
        await supabaseFetch('stock_items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemsWithUser)
        });
        return null;
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao importar itens');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success(`${variables.length} itens criados com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar itens: ${err.message}`);
    },
  });

  const processInvoiceImport = useMutation({
    mutationFn: async ({ nfeData, mappedItems }: { nfeData: any, mappedItems: any[] }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      console.log("Processing Invoice Import:", { nfeData, mappedItems });

      // 1. Create Financial Expense
      const expense = {
        user_id: ownerId,
        description: `Compra: ${nfeData.supplierName} (NF ${nfeData.invoiceNumber})`,
        amount: nfeData.totalValue,
        category: 'variable',
        type: 'invoice',
        date: nfeData.emissionDate.split('T')[0],
        status: 'paid',
        invoice_number: nfeData.invoiceNumber,
        notes: `Importação automática via XML. Fornecedor: ${nfeData.supplierName}`
      };

      await supabaseFetch('financial_expenses', {
        method: 'POST',
        body: JSON.stringify(expense)
      });

      // 2. Process Items
      for (const item of mappedItems) {
        let stockItemId = item.matchedId;

        if (item.matchedId === 'new') {
          // Create new item
          const { data: newItem } = await supabase.from('stock_items').insert({
            user_id: ownerId,
            name: item.name,
            current_quantity: item.quantity,
            unit: item.unit,
            category: item.category || 'outros',
            unit_price: item.unitPrice,
            notes: `Criado via NF ${nfeData.invoiceNumber}`
          }).select().single();
          
          if (newItem) stockItemId = newItem.id;
        } else {
          // Update existing item quantity and price
          const existingItem = items.find(ei => ei.id === item.matchedId);
          if (existingItem) {
            const newQuantity = Number(existingItem.current_quantity) + item.quantity;
            await supabase.from('stock_items').update({
              current_quantity: newQuantity,
              unit_price: item.unitPrice,
              updated_at: new Date().toISOString()
            }).eq('id', item.matchedId);

            // Create movement
            await supabase.from('stock_movements').insert({
              user_id: ownerId,
              stock_item_id: item.matchedId,
              type: 'entry',
              quantity: item.quantity,
              source: 'purchase',
              notes: `NF ${nfeData.invoiceNumber} - ${nfeData.supplierName}`
            });
          }
        }

        // 3. Create Purchase List Entry (for reports)
        if (stockItemId) {
          await supabase.from('purchase_list_items').insert({
            user_id: ownerId,
            stock_item_id: stockItemId,
            suggested_quantity: item.quantity,
            ordered_quantity: item.quantity,
            status: 'delivered',
            actual_delivery_date: new Date().toISOString().split('T')[0],
            order_date: nfeData.emissionDate.split('T')[0],
            notes: `NF ${nfeData.invoiceNumber}`
          });
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['financial_expenses'] });
      toast.success('Nota Fiscal importada e estoque atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro na importação: ${err.message}`);
    }
  });

  return {
    items,
    isLoading,
    isOwnerLoading,
    error,
    createItem,
    batchCreateItems,
    processInvoiceImport,
    updateItem,
    deleteItem,
    itemsInAlert,
  };
}
