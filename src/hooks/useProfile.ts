import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { supabaseFetch } from '@/lib/supabase-fetch';

export function useProfile() {
    const { user } = useAuth();

    const { data: profile, isLoading, error, refetch } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            try {
                // First get basic profile (array format to behave like maybeSingle)
                let profiles: any = null;
                try {
                    profiles = await supabaseFetch(`profiles?id=eq.${user.id}&select=*`);
                } catch (fetchErr: any) {
                    if (fetchErr.status === 406 || fetchErr.message?.includes('PGRST116')) {
                        console.warn("useProfile: 406/PGRST116 Profile not found, proceeding to fallback creation...");
                        profiles = null;
                    } else {
                        throw fetchErr;
                    }
                }

                let profile = Array.isArray(profiles) ? profiles[0] : profiles;

                // If profile doesn't exist, user must register via the signup form
                if (!profile) {
                    console.warn("useProfile: No profile found. User needs to register first.");
                    return null;
                }

                if (profile && profile.role === 'colaborador') {
                    // Fetch collaborator specific data (permissions)
                    const collabData = await supabaseFetch(`collaborators?auth_user_id=eq.${user.id}&select=*`, {
                        headers: {
                            'Accept': 'application/vnd.pgrst.object+json'
                        }
                    });

                    if (collabData) {
                        return { ...profile, ...collabData };
                    }
                }

                return profile;
            } catch (err) {
                console.error("useProfile: FETCH ERROR", err);
                throw err;
            }
        },
        enabled: !!user?.id,
        retry: 1,
        staleTime: 30_000,        // Profile re-fetches after 30s (catches admin DB updates quickly)
        gcTime: 5 * 60 * 1000,
    });


    return {
        profile,
        isLoading,
        error,
        refetch,
    };
}
