-- Migration to fix RLS recursion on profiles table
-- Created by Antigravity on 2026-02-21

-- 1. Create a helper function to check admin role without triggering RLS recursively
-- We use SECURITY DEFINER and a specific SET search_path to be safe.
-- Crucially, we use a query that Postgres can optimize or bypass the recursive RLS check.
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.business_role;
BEGIN
  -- We query the table directly as a privileged user (security definer)
  -- This avoids the recursive trigger on the table itself.
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'admin'::public.business_role;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- 3. Create a safer policy using the helper function for ADMINS
CREATE POLICY "Admins have full access"
ON public.profiles
FOR ALL
USING (
  public.check_is_admin()
);

-- Alternative: Simplest possible non-recursive policy for self
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR public.check_is_admin());



-- 5. Update user-specific edit policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);
