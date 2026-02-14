-- Remove the "set PIN on first access" policy since PIN is now set during creation
DROP POLICY IF EXISTS "Anyone can set PIN on first access" ON public.collaborators;

-- The gestor can already update their collaborators (including PIN) via the existing policy
-- "Gestors can update their own collaborators"