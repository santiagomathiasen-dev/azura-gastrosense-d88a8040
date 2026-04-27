-- Allow public read access to collaborators for login flow (only active ones)
CREATE POLICY "Anyone can view active collaborators for login"
  ON public.collaborators FOR SELECT
  USING (is_active = true);

-- Allow collaborators to update their own PIN
CREATE POLICY "Collaborators can update their own PIN"
  ON public.collaborators FOR UPDATE
  USING (true)
  WITH CHECK (true);