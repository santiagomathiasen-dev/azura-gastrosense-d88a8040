-- ========================================================================================
-- SYSTEM: Azura GastroSense
-- DESC: Add dynamic DEFAULT fallback to user_id columns using public.get_owner_id()
--       This prevents 42501 RLS violations when the frontend accidentally omits the user_id payload
-- ========================================================================================

-- Ensuring the helper exists (it should, as seen in FIX_RLS_POLICIES.sql)
CREATE OR REPLACE FUNCTION public.get_owner_id() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_gestor_id uuid;
BEGIN
SELECT gestor_id INTO v_gestor_id
FROM public.profiles
WHERE id = auth.uid();
RETURN COALESCE(v_gestor_id, auth.uid());
END;
$$;

-- Applying the DEFAULT to all relevant protected tables
ALTER TABLE public.stock_items ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.stock_movements ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.technical_sheets ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.productions ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.purchase_list_items ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.purchase_schedule ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.sale_products ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.finished_productions_stock ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
ALTER TABLE public.suppliers ALTER COLUMN user_id SET DEFAULT public.get_owner_id();
