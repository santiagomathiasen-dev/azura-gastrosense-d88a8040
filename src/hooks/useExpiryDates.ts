import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExpiryDate {
    id: string;
    user_id: string;
    stock_item_id: string;
    expiry_date: string;
    batch_name: string | null;
    quantity: number;
    notes: string | null;
    created_at: string;
}

export interface CreateExpiryDate {
    stock_item_id: string;
    expiry_date: string;
    batch_name?: string;
    quantity?: number;
    notes?: string;
}

export function useExpiryDates(stockItemId?: string) {
    const queryClient = useQueryClient();

    const { data: expiryDates = [], isLoading } = useQuery({
        queryKey: ['expiry-dates', stockItemId],
        queryFn: async () => {
            let query = supabase
                .from('item_expiry_dates' as any)
                .select('*')
                .order('expiry_date', { ascending: true });

            if (stockItemId) {
                query = query.eq('stock_item_id', stockItemId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []) as unknown as ExpiryDate[];
        },
        enabled: true,
    });

    const addExpiryDate = useMutation({
        mutationFn: async (newDate: CreateExpiryDate) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            const { data, error } = await supabase
                .from('item_expiry_dates' as any)
                .insert({
                    user_id: user.id,
                    stock_item_id: newDate.stock_item_id,
                    expiry_date: newDate.expiry_date,
                    batch_name: newDate.batch_name || null,
                    quantity: newDate.quantity || 0,
                    notes: newDate.notes || null,
                } as any)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expiry-dates'] });
            toast.success('Data de validade adicionada!');
        },
        onError: (error) => {
            console.error('Error adding expiry date:', error);
            toast.error('Erro ao adicionar data de validade');
        },
    });

    const removeExpiryDate = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('item_expiry_dates' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expiry-dates'] });
            toast.success('Data de validade removida!');
        },
        onError: (error) => {
            console.error('Error removing expiry date:', error);
            toast.error('Erro ao remover data de validade');
        },
    });

    // Get all expiry alerts (items near or past expiry)
    const getExpiryAlerts = (allDates: ExpiryDate[], daysThreshold = 7) => {
        const now = new Date();
        const thresholdDate = new Date();
        thresholdDate.setDate(now.getDate() + daysThreshold);

        return allDates.filter(d => {
            const expiry = new Date(d.expiry_date);
            return expiry <= thresholdDate;
        }).map(d => {
            const expiry = new Date(d.expiry_date);
            const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...d,
                daysUntil,
                isExpired: daysUntil < 0,
                isNearExpiry: daysUntil >= 0 && daysUntil <= daysThreshold,
            };
        }).sort((a, b) => a.daysUntil - b.daysUntil);
    };

    return {
        expiryDates,
        isLoading,
        addExpiryDate,
        removeExpiryDate,
        getExpiryAlerts,
    };
}

// Hook to get ALL expiry dates for dashboard alerts
export function useAllExpiryAlerts(daysThreshold = 7) {
    const { data: allExpiryDates = [], isLoading } = useQuery({
        queryKey: ['expiry-dates-all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('item_expiry_dates' as any)
                .select(`
          *,
          stock_item:stock_items(id, name, unit, category)
        `)
                .order('expiry_date', { ascending: true });

            if (error) throw error;
            return (data || []) as unknown as (ExpiryDate & { stock_item: { id: string; name: string; unit: string; category: string } })[];
        },
    });

    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);

    const alerts = allExpiryDates
        .filter(d => {
            const expiry = new Date(d.expiry_date);
            return expiry <= thresholdDate;
        })
        .map(d => {
            const expiry = new Date(d.expiry_date);
            const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...d,
                daysUntil,
                isExpired: daysUntil < 0,
                isNearExpiry: daysUntil >= 0 && daysUntil <= daysThreshold,
            };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil);

    return {
        alerts,
        isLoading,
        totalAlerts: alerts.length,
        expiredCount: alerts.filter(a => a.isExpired).length,
        nearExpiryCount: alerts.filter(a => a.isNearExpiry).length,
    };
}
