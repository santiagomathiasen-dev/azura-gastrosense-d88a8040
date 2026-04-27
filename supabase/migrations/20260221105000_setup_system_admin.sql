-- Final system admin setup
-- Created by Antigravity on 2026-02-21

-- 1. Ensure the user exists in profiles and has the 'admin' role
INSERT INTO public.profiles (id, email, role, status)
SELECT id, email, 'admin'::public.business_role, 'ativo'
FROM auth.users
WHERE email = 'santiago.aloom@gmail.com'
ON CONFLICT (id) DO UPDATE SET 
    role = 'admin',
    status = 'ativo';

-- 2. Grant bypass for standard RLS checks if needed (via the check_is_admin function we created)
-- Already handled by the "Admins can view and edit all profiles" policy

-- 3. Verify all tables have the Admin policy
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "System Admin full access on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "System Admin full access on %I" ON public.%I FOR ALL USING (public.check_is_admin())', t, t);
    END LOOP;
END
$$;
