import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface PreparationAlert {
    id: string;
    user_id: string;
    sale_product_id: string;
    missing_component_id: string;
    missing_component_type: string;
    missing_quantity: number;
    resolved: boolean;
    created_at: string;
    sale_product?: { name: string };
    missing_component_name?: string;
}

export function usePreparationAlerts() {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: alerts = [], isLoading } = useQuery({
        queryKey: ['preparation_alerts', ownerId],
        queryFn: async () => {
            if (!user?.id && !ownerId) return [];

            const { data, error } = await (supabase as any)
                .from('preparation_alerts')
                .select(`
          *,
          sale_product:sale_products(name)
        `)
                .eq('resolved', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data?.length) return [];

            // Batch fetch all component names in 3 queries instead of N+1
            const ids = { stock_item: [] as string[], finished_production: [] as string[], sale_product: [] as string[] };
            for (const a of data) {
                const bucket = ids[a.missing_component_type as keyof typeof ids];
                if (bucket && a.missing_component_id) bucket.push(a.missing_component_id);
            }

            const nameMap = new Map<string, string>();

            const [stockRes, sheetRes, productRes] = await Promise.all([
                ids.stock_item.length
                    ? (supabase as any).from('stock_items').select('id, name').in('id', ids.stock_item)
                    : { data: [] },
                ids.finished_production.length
                    ? (supabase as any).from('technical_sheets').select('id, name').in('id', ids.finished_production)
                    : { data: [] },
                ids.sale_product.length
                    ? (supabase as any).from('sale_products').select('id, name').in('id', ids.sale_product)
                    : { data: [] },
            ]);

            for (const item of (stockRes.data ?? [])) nameMap.set(item.id, item.name);
            for (const item of (sheetRes.data ?? [])) nameMap.set(item.id, item.name);
            for (const item of (productRes.data ?? [])) nameMap.set(item.id, item.name);

            return data.map((alert: any) => ({
                ...alert,
                missing_component_name: nameMap.get(alert.missing_component_id) || 'Desconhecido',
            })) as PreparationAlert[];
        },
        enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
        refetchInterval: 120_000,
        staleTime: 60_000,
    });

    const resolveAlert = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any)
                .from('preparation_alerts')
                .update({ resolved: true })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['preparation_alerts'] });
            toast.success('Alerta resolvido!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao resolver alerta: ${err.message}`);
        },
    });

    return {
        alerts,
        isLoading,
        resolveAlert,
    };
}
