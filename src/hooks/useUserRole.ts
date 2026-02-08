import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'user';

export function useUserRole() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: userRole, isLoading } = useQuery({
    queryKey: ['user_role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // No role means regular user
        if (error.code === 'PGRST116') return 'user' as AppRole;
        throw error;
      }

      return data?.role as AppRole || 'user';
    },
    enabled: !!user?.id,
  });

  const isAdmin = userRole === 'admin';

  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // First check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_role'] });
      toast.success('Papel atribuído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atribuir papel: ${err.message}`);
    },
  });

  return {
    userRole,
    isAdmin,
    isLoading,
    assignRole,
  };
}
