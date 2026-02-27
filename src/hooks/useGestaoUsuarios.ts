import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { adminSupabase } from '../integrations/supabase/adminClient'; // admin client for protected functions
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

export interface Gestor extends Profile {
    can_access_dashboard: boolean;
    can_access_estoque: boolean;
    can_access_estoque_producao: boolean;
    can_access_fichas: boolean;
    can_access_producao: boolean;
    can_access_compras: boolean;
    can_access_finalizados: boolean;
    can_access_produtos_venda: boolean;
    can_access_financeiro: boolean;
    can_access_relatorios: boolean;
    status_pagamento: boolean;
}

export function useGestaoUsuarios() {
    const queryClient = useQueryClient();

    const { data: profiles = [], isLoading, error } = useQuery({
        queryKey: ['profiles-management'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map((p: any) => ({
                ...p,
                status: p.status || 'ativo',
                can_access_financeiro: p.can_access_financeiro ?? true,
                can_access_relatorios: p.can_access_relatorios ?? true,
            })) as Gestor[];
        },
    });

    const createGestor = useMutation({
        mutationFn: async (data: any) => {
            const { data: result, error } = await adminSupabase.functions.invoke('manage-gestors', {
                body: { action: 'create', ...data },
            });
            if (error) throw error;
            if (result?.error) throw new Error(result.error);
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Gestor criado com sucesso');
        },
        onError: (error: any) => {
            toast.error('Erro ao criar gestor: ' + error.message);
        }
    });

    const updatePermissions = useMutation({
        mutationFn: async ({ gestorId, permissions }: { gestorId: string; permissions: any }) => {
            const { data: result, error } = await adminSupabase.functions.invoke('manage-gestors', {
                body: { action: 'update_permissions', gestorId, permissions },
            });
            if (error) throw error;
            if (result?.error) throw new Error(result.error);
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Permissões atualizadas');
        }
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) => {
            const { data: result, error } = await adminSupabase.functions.invoke('manage-gestors', {
                body: { action: 'toggle_status', gestorId: id, active: status === 'ativo' },
            });
            if (error) throw error;
            if (result?.error) throw new Error(result.error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Status atualizado');
        },
    });

    const deleteGestor = useMutation({
        mutationFn: async (id: string) => {
            const { data: result, error } = await adminSupabase.functions.invoke('manage-gestors', {
                body: { action: 'delete', gestorId: id },
            });
            if (error) throw error;
            if (result?.error) throw new Error(result.error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Gestor excluído');
        }
    });

    return {
        profiles,
        isLoading,
        error,
        createGestor,
        updatePermissions,
        updateStatus,
        deleteGestor
    };
}

