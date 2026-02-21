import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useProfile() {
    const { user } = useAuth();

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            console.log("useProfile: fetching profile for", user.id);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error("useProfile: ERROR", error);
                throw error;
            }
            console.log("useProfile: SUCCESS", data);
            return data;
        },
        enabled: !!user?.id,
        retry: false,
    });


    return {
        profile,
        isLoading,
        error,
    };
}
