-- Migration to fix RLS recursion on profiles table
-- Created by Antigravity on 2026-02-21

-- 1. Create a helper function to check admin role without triggering RLS recursively
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can view and edit all profiles" ON public.profiles;

-- 3. Create a safer policy using the helper function
CREATE POLICY "Admins can view and edit all profiles"
ON public.profiles
FOR ALL
USING (
  public.check_is_admin()
);

-- 4. Ensure other policies on profiles are also safe (Users can always view their own profile)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- 5. Update user-specific edit policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);
