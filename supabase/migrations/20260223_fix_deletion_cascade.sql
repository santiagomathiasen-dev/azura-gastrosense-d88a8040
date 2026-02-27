-- Fix Foreign Key Constraints for cascading deletes
-- This allows eliminating gestors and having their collaborators/profiles deleted automatically

-- 1. Profiles Table: Add CASCADE to gestor_id
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_gestor_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_gestor_id_fkey
FOREIGN KEY (gestor_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 2. Collaborators Table: Add CASCADE to gestor_id
ALTER TABLE public.collaborators
DROP CONSTRAINT IF EXISTS collaborators_gestor_id_fkey;

ALTER TABLE public.collaborators
ADD CONSTRAINT collaborators_gestor_id_fkey
FOREIGN KEY (gestor_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Also allow auth_user_id to cascade if the auth user is deleted
ALTER TABLE public.collaborators
DROP CONSTRAINT IF EXISTS collaborators_auth_user_id_fkey;

ALTER TABLE public.collaborators
ADD CONSTRAINT collaborators_auth_user_id_fkey
FOREIGN KEY (auth_user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 3. Ensure Admins can delete anything (RLS)
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can delete any collaborator" ON public.collaborators;
CREATE POLICY "Admins can delete any collaborator"
ON public.collaborators
FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
