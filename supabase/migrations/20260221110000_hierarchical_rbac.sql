-- Hierarchical RBAC and Ownership Logic
-- Created by Antigravity on 2026-02-21

-- 1. Helper for Admin check (Non-recursive)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.business_role;
BEGIN
  -- Direct check in profiles table with limited depth
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'admin'::public.business_role;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- 2. Function to determine data owner (hierarchical)
-- If user is gestor, returns their own id.
-- If user is colaborador, returns their gestor_id.
-- If user is admin (Santiago), they bypass RLS anyway or can impersonate.
CREATE OR REPLACE FUNCTION public.get_owner_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gestor_id uuid;
  v_role public.business_role;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT role, gestor_id INTO v_role, v_gestor_id 
  FROM public.profiles 
  WHERE id = v_user_id;

  IF v_role = 'gestor'::public.business_role THEN
    RETURN v_user_id;
  ELSIF v_role = 'colaborador'::public.business_role THEN
    RETURN v_gestor_id;
  ELSE
    RETURN v_user_id; -- For admins, they usually see everything anyway
  END IF;
END;
$$;

-- 3. Update Profiles RLS
DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Admin bypass
CREATE POLICY "Admins have full access"
ON public.profiles
FOR ALL
USING (public.check_is_admin());

-- Gestors can see and manage their collaborators
CREATE POLICY "Gestors manage their collaborators"
ON public.profiles
FOR ALL
USING (gestor_id = auth.uid());

-- Everyone can see their own profile
CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

-- 4. Apply Global RLS Filter for all data tables
-- All business data tables should filter by public.get_owner_id()
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('profiles', 'collaborators', 'user_roles', 'login_rate_limits')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Hierarchical Access on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Hierarchical Access on %I" ON public.%I FOR ALL USING (user_id = public.get_owner_id() OR public.check_is_admin())', t, t);
    END LOOP;
END
$$;
