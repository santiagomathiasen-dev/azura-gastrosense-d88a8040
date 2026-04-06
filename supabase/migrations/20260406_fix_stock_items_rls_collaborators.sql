-- Fix stock_items RLS to support collaborators accessing gestor data
-- Current policies use auth.uid() = user_id which blocks collaborators
-- New policies use can_access_owner_data() and get_owner_id() like other tables

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view their own stock items" ON public.stock_items;
DROP POLICY IF EXISTS "Users can insert their own stock items" ON public.stock_items;
DROP POLICY IF EXISTS "Users can update their own stock items" ON public.stock_items;
DROP POLICY IF EXISTS "Users can delete their own stock items" ON public.stock_items;

-- Create new policies that support collaborator access
CREATE POLICY "Users can view accessible stock items"
  ON public.stock_items FOR SELECT
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can insert stock items for their org"
  ON public.stock_items FOR INSERT
  WITH CHECK (user_id = get_owner_id());

CREATE POLICY "Users can update accessible stock items"
  ON public.stock_items FOR UPDATE
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can delete accessible stock items"
  ON public.stock_items FOR DELETE
  USING (can_access_owner_data(user_id));

-- Also fix stock_movements if it has the same issue
DROP POLICY IF EXISTS "Users can view their own stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can insert their own stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can update their own stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can delete their own stock movements" ON public.stock_movements;

CREATE POLICY "Users can view accessible stock movements"
  ON public.stock_movements FOR SELECT
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can insert stock movements for their org"
  ON public.stock_movements FOR INSERT
  WITH CHECK (user_id = get_owner_id());

CREATE POLICY "Users can update accessible stock movements"
  ON public.stock_movements FOR UPDATE
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can delete accessible stock movements"
  ON public.stock_movements FOR DELETE
  USING (can_access_owner_data(user_id));
