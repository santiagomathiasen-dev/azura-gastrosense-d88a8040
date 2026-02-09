-- Remove the overly permissive public SELECT policy on collaborators
-- This policy allows unauthenticated users to see all active collaborators
-- The collaborator-login edge function uses service role so doesn't need this
DROP POLICY IF EXISTS "Anyone can view active collaborators for login" ON public.collaborators;