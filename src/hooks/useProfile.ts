import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useProfile() {
    const { user } = useAuth();

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
    });

    return {
        profile,
        isLoading,
        error,
    };
}
