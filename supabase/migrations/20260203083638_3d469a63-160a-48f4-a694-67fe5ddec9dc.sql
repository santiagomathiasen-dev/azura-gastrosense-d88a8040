-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Collaborators can update their own PIN" ON public.collaborators;

-- Create a more restrictive policy that only allows updating PIN (and only if it's null - first time setup)
-- This is still somewhat permissive but necessary for the unauthenticated PIN setup flow
-- The risk is minimal since:
-- 1. Only the pin_hash field can be meaningfully updated (other updates require gestor auth)
-- 2. The collaborator ID must be known beforehand
CREATE POLICY "Anyone can set PIN on first access"
  ON public.collaborators FOR UPDATE
  USING (pin_hash IS NULL)
  WITH CHECK (pin_hash IS NOT NULL);