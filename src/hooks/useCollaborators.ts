import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Collaborator {
  id: string;
  gestor_id: string;
  name: string;
  email: string | null;
  pin_hash: string | null;
  auth_user_id: string | null;
  is_active: boolean;
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
  created_at: string;
  updated_at: string;
}

export interface CollaboratorPermissions {
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
}

// Hash function for PIN
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'azura_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useCollaborators() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      let query = supabase
        .from('collaborators')
        .select('*');

      // If not admin, filter by gestor_id
      if (profile?.role !== 'admin') {
        query = query.eq('gestor_id', user.id);
      }

      const { data, error } = await query.order('name');

      if (error) {
        console.error("useCollaborators QUERY ERROR:", error);
        throw error;
      }

      // Map back to interface expected by UI
      return (data as any[]).map(p => ({
        ...p,
        is_active: p.is_active
      })) as Collaborator[];
    },
    enabled: !!user?.id,
  });

  const createCollaborator = useMutation({
    mutationFn: async ({ name, email, password, pin, permissions }: { name: string; email: string; password?: string; pin?: string; permissions: any }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Edge function still handles the complex Auth creation
      const { data, error } = await supabase.functions.invoke('create-collaborator', {
        body: { name, email, password, pin, permissions },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data.collaborator;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('Colaborador criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar colaborador: ${err.message}`);
    },
  });

  const updateCollaborator = useMutation({
    mutationFn: async ({ id, name, pin, permissions }: { id: string; name: string; pin?: string; permissions: any }) => {
      const { role, ...otherPerms } = permissions;

      const updateData: Record<string, unknown> = {
        name: name,
        ...otherPerms,
      };

      if (pin) {
        updateData.pin_hash = await hashPin(pin);
      }

      // Update collaborators table
      const { error: collabError } = await supabase
        .from('collaborators')
        .update(updateData as any)
        .eq('id', id);

      if (collabError) throw collabError;

      // Also update role in profiles table if it's connected to an auth user
      const { data: collabData } = await supabase
        .from('collaborators')
        .select('auth_user_id')
        .eq('id', id)
        .single();

      if (collabData?.auth_user_id && role) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role,
            gestor_id: role === 'gestor' || role === 'admin' ? null : user?.id,
            ...otherPerms
          } as any)
          .eq('id', collabData.auth_user_id);

        if (profileError) {
          console.error("Error updating profile role:", profileError);
          // Don't throw here to not block the whole operation if profile update fails
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('Colaborador atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  const deleteCollaborator = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('delete-collaborator', {
        body: { collaboratorId: id },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('Colaborador removido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('collaborators')
        .update({ is_active: isActive } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });

  const resetPin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('collaborators')
        .update({ pin_hash: null } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('PIN resetado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao resetar PIN: ${err.message}`);
    },
  });

  return {
    collaborators,
    isLoading,
    createCollaborator,
    updateCollaborator,
    deleteCollaborator,
    toggleActive,
    resetPin,
  };
}

export function useCollaboratorAuth() {
  const verifyPin = async (collaboratorId: string, pin: string): Promise<boolean> => {
    const hashedPin = await hashPin(pin);

    const { data, error } = await supabase
      .from('collaborators')
      .select('pin_hash')
      .eq('id', collaboratorId)
      .single();

    if (error || !data) return false;
    return data.pin_hash === hashedPin;
  };

  const setPin = async (collaboratorId: string, pin: string): Promise<boolean> => {
    const hashedPin = await hashPin(pin);

    const { error } = await supabase
      .from('collaborators')
      .update({ pin_hash: hashedPin } as any)
      .eq('id', collaboratorId);

    return !error;
  };

  return {
    verifyPin,
    setPin,
  };
}
