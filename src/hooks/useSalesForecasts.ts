import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface SalesForecast {
    id: string;
    user_id: string;
    sale_product_id: string;
    target_date: string;
    forecasted_quantity: number;
    notes: string | null;
    created_at: string;
    sale_product?: { id: string; name: string; image_url: string | null };
}

export function useSalesForecasts(targetDate?: string) {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: forecasts = [], isLoading } = useQuery({
        queryKey: ['sales_forecasts', ownerId, targetDate],
        queryFn: async () => {
            if (!user?.id && !ownerId) return [];

            let query = supabase
                .from('sales_forecasts')
                .select(`
          *,
          sale_product:sale_products(id, name, image_url)
        `)
                .order('created_at', { ascending: false });

            if (targetDate) {
                query = query.eq('target_date', targetDate);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as SalesForecast[];
        },
        enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
        refetchInterval: 30_000,
    });

    const createForecast = useMutation({
        mutationFn: async (forecast: {
            sale_product_id: string;
            target_date: string;
            forecasted_quantity: number;
            notes?: string;
        }) => {
            if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
            if (!ownerId) throw new Error('Usuário não autenticado');

            const { error } = await supabase
                .from('sales_forecasts')
                .upsert({
                    user_id: ownerId,
                    sale_product_id: forecast.sale_product_id,
                    target_date: forecast.target_date,
                    forecasted_quantity: forecast.forecasted_quantity,
                    notes: forecast.notes || null,
                }, {
                    onConflict: 'user_id,target_date,sale_product_id',
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] });
            toast.success('Previsão salva!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao salvar previsão: ${err.message}`);
        },
    });

    const updateForecast = useMutation({
        mutationFn: async ({ id, ...updates }: {
            id: string;
            forecasted_quantity?: number;
            notes?: string;
        }) => {
            const { error } = await supabase
                .from('sales_forecasts')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] });
            toast.success('Previsão atualizada!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao atualizar previsão: ${err.message}`);
        },
    });

    const deleteForecast = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('sales_forecasts')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] });
            toast.success('Previsão removida!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao remover previsão: ${err.message}`);
        },
    });

    return {
        forecasts,
        isLoading,
        createForecast,
        updateForecast,
        deleteForecast,
    };
}
