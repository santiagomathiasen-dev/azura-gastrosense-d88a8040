import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';

type TableName =
  | 'stock_items'
  | 'technical_sheets'
  | 'productions'
  | 'finished_productions_stock'
  | 'production_stock'
  | 'suppliers'
  | 'stock_movements'
  | 'purchase_list_items'
  | 'sale_products'
  | 'sales'
  | 'technical_sheet_ingredients'
  | 'sale_product_components'
  | 'stock_requests'
  | 'stock_transfers';

interface UseRealtimeOptions {
  tables: TableName[];
}

/**
 * Hook that subscribes to realtime changes on specified tables.
 * Automatically invalidates the relevant queries when data changes.
 */
export function useRealtimeSubscription({ tables }: UseRealtimeOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isCollaboratorMode, gestorId } = useCollaboratorContext();

  useEffect(() => {
    // Only subscribe if we have a user or are in collaborator mode
    if (!user?.id && !isCollaboratorMode) return;

    const channels = tables.map((table) => {
      const channel = supabase
        .channel(`realtime_${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          (payload) => {
            console.log(`Realtime update on ${table}:`, payload.eventType);

            // Invalidate all related queries
            queryClient.invalidateQueries({ queryKey: [table] });

            // Also invalidate related queries based on table relationships
            if (table === 'stock_items') {
              queryClient.invalidateQueries({ queryKey: ['production_stock'] });
              queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
            }
            if (table === 'technical_sheets') {
              queryClient.invalidateQueries({ queryKey: ['productions'] });
              queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
            }
            if (table === 'productions') {
              queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
              queryClient.invalidateQueries({ queryKey: ['stock_items'] });
            }
            if (table === 'stock_movements') {
              queryClient.invalidateQueries({ queryKey: ['stock_items'] });
            }
            if (table === 'technical_sheet_ingredients') {
              queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
            }
            if (table === 'sale_product_components') {
              queryClient.invalidateQueries({ queryKey: ['sale_products'] });
            }
          }
        )
        .subscribe();

      return channel;
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [user?.id, isCollaboratorMode, gestorId, tables, queryClient]);
}

const GLOBAL_TABLES: TableName[] = [
  'stock_items',
  'technical_sheets',
  'productions',
  'finished_productions_stock',
  'production_stock',
  'suppliers',
  'stock_movements',
  'purchase_list_items',
  'sale_products',
  'sales',
  'technical_sheet_ingredients',
  'sale_product_components',
  'stock_requests',
  'stock_transfers',
];

/**
 * Preset hook for subscribing to all main data tables
 */
export function useGlobalRealtimeSync() {
  useRealtimeSubscription({
    tables: GLOBAL_TABLES,
  });
}


