import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

export type BusinessRole = Database['public']['Enums']['business_role'];

export interface Profile {
    id: string;
    full_name: string | null;
    email: string | null;
    role: BusinessRole;
    status: 'ativo' | 'inativo';
    created_at: string;
}

export function useGestaoUsuarios() {
    const queryClient = useQueryClient();

    const { data: profiles = [], isLoading, error } = useQuery({
        queryKey: ['profiles-management'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, status, created_at')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching profiles:', error);
                throw error;
            }

            // Map and ensure status has a default value
            return ((data as any[]) || []).map(p => ({
                ...p,
                status: p.status || 'ativo'
            })) as Profile[];
        },
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) => {
            const { error } = await supabase
                .from('profiles')
                .update({ status } as any)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Status atualizado com sucesso');
        },
        onError: (error: any) => {
            console.error('Error updating status:', error);
            toast.error('Erro ao atualizar status: ' + error.message);
        },
    });

    const updateRole = useMutation({
        mutationFn: async ({ id, role }: { id: string; role: BusinessRole }) => {
            const { error } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Cargo atualizado com sucesso');
        },
        onError: (error: any) => {
            console.error('Error updating role:', error);
            toast.error('Erro ao atualizar cargo: ' + error.message);
        },
    });

    return {
        profiles,
        isLoading,
        error,
        updateStatus,
        updateRole
    };
}
