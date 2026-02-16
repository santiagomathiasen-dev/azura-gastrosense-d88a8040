import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface ForecastProductionOrder {
    id: string;
    user_id: string;
    forecast_id: string | null;
    technical_sheet_id: string;
    production_date: string;
    target_consumption_date: string;
    required_quantity: number;
    existing_stock: number;
    net_quantity: number;
    praca: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    linked_production_id: string | null;
    created_at: string;
    updated_at: string;
    technical_sheet?: {
        id: string;
        name: string;
        yield_unit: string;
        yield_quantity: number;
        image_url: string | null;
    };
}

export const PRACA_LABELS: Record<string, string> = {
    gelateria: 'Gelateria',
    confeitaria: 'Confeitaria',
    padaria: 'Padaria',
    praca_quente: 'Praça Quente',
    bar: 'Bar',
};

export const FORECAST_STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluído',
    cancelled: 'Cancelado',
};

export function useForecastProductionOrders(productionDate?: string) {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['forecast_production_orders', ownerId, productionDate],
        queryFn: async () => {
            if (!user?.id && !ownerId) return [];

            let query = supabase
                .from('forecast_production_orders')
                .select(`
          *,
          technical_sheet:technical_sheets(id, name, yield_unit, yield_quantity, image_url)
        `)
                .order('production_date', { ascending: true });

            if (productionDate) {
                query = query.eq('production_date', productionDate);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as ForecastProductionOrder[];
        },
        enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
        refetchInterval: 15_000,
    });

    const updateOrderStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const { error } = await supabase
                .from('forecast_production_orders')
                .update({ status })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['forecast_production_orders'] });
            toast.success('Status atualizado!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao atualizar status: ${err.message}`);
        },
    });

    const deleteOrder = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('forecast_production_orders')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['forecast_production_orders'] });
            toast.success('Ordem removida!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao remover: ${err.message}`);
        },
    });

    // Group orders by praca for the kitchen screen
    const ordersByPraca = orders.reduce((acc, order) => {
        const praca = order.praca || 'praca_quente';
        if (!acc[praca]) acc[praca] = [];
        acc[praca].push(order);
        return acc;
    }, {} as Record<string, ForecastProductionOrder[]>);

    // Summary counts
    const summary = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        inProgress: orders.filter(o => o.status === 'in_progress').length,
        completed: orders.filter(o => o.status === 'completed').length,
    };

    return {
        orders,
        ordersByPraca,
        summary,
        isLoading,
        updateOrderStatus,
        deleteOrder,
    };
}
