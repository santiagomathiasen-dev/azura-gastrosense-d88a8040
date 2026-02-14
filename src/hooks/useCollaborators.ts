import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Collaborator {
  id: string;
  gestor_id: string;
  name: string;
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

      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('gestor_id', user.id)
        .order('name');

      if (error) throw error;
      return data as Collaborator[];
    },
    enabled: !!user?.id,
  });

  const createCollaborator = useMutation({
    mutationFn: async ({ name, pin, permissions }: { name: string; pin: string; permissions: CollaboratorPermissions }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Use Edge Function to create collaborator with Supabase Auth account
      const { data, error } = await supabase.functions.invoke('create-collaborator', {
        body: { name, pin, permissions },
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
    mutationFn: async ({ id, name, pin, permissions }: { id: string; name: string; pin?: string; permissions: CollaboratorPermissions }) => {
      const updateData: Record<string, unknown> = {
        name,
        ...permissions,
      };

      // Only update PIN if provided
      if (pin) {
        updateData.pin_hash = await hashPin(pin);
      }

      const { error } = await supabase
        .from('collaborators')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
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
      // Use Edge Function to delete collaborator and their Supabase Auth account
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
        .update({ is_active: isActive })
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
        .update({ pin_hash: null })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('PIN resetado! O colaborador precisará definir um novo PIN no próximo acesso.');
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

// Hook for collaborator login flow
export function useCollaboratorAuth() {
  // Verify collaborator by gestor email + PIN directly
  const verifyPinByEmail = async (gestorEmail: string, pin: string): Promise<{ 
    collaborator: Collaborator; 
    gestorId: string;
    session?: { access_token: string; refresh_token: string };
  } | null> => {
    // Use backend function (avoids RLS issues for unauthenticated collaborator login)
    const { data, error } = await supabase.functions.invoke('collaborator-login', {
      body: { gestorEmail, pin },
    });

    if (error || !data?.collaborator || !data?.gestorId) {
      return null;
    }

    return {
      collaborator: data.collaborator as Collaborator,
      gestorId: data.gestorId as string,
      session: data.session,
    };
  };

  // Legacy function for fetching collaborators by gestor email
  const fetchCollaboratorsByGestorEmail = async (email: string): Promise<Collaborator[]> => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .eq('role', 'gestor')
      .single();

    if (profileError || !profile) {
      return [];
    }

    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .eq('gestor_id', profile.id)
      .eq('is_active', true)
      .order('name');

    if (error) return [];
    return data as Collaborator[];
  };

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
      .update({ pin_hash: hashedPin })
      .eq('id', collaboratorId);

    return !error;
  };

  return {
    verifyPinByEmail,
    fetchCollaboratorsByGestorEmail,
    verifyPin,
    setPin,
  };
}
