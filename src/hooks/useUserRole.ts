import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'gestor' | 'colaborador' | 'user';

export function useUserRole() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user_profile_role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('role, email, status')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const userRole = profile?.role as AppRole;
  const isAdmin = userRole === 'admin';
  const isGestor = userRole === 'gestor';
  const isColaborador = userRole === 'colaborador';
  const isBlocked = profile?.status === 'inativo';

  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role } as any)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_profile_role'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
      toast.success('Papel atribuído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atribuir papel: ${err.message}`);
    },
  });

  return {
    userRole,
    isAdmin,
    isGestor,
    isColaborador,
    isBlocked,
    isLoading,
    assignRole,
    profile,
  };
}
