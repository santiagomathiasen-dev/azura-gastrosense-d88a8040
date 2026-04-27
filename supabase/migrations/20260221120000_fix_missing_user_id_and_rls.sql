-- =====================================================
-- FIX: Missing user_id columns and hierarchical RLS
-- =====================================================

-- 1. Add user_id to technical_sheet_stages
ALTER TABLE public.technical_sheet_stages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.technical_sheet_stages tss
SET user_id = ts.user_id
FROM public.technical_sheets ts
WHERE tss.technical_sheet_id = ts.id AND tss.user_id IS NULL;

-- 2. Add user_id to technical_sheet_stage_steps
ALTER TABLE public.technical_sheet_stage_steps ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.technical_sheet_stage_steps tsss
SET user_id = tss.user_id
FROM public.technical_sheet_stages tss
WHERE tsss.stage_id = tss.id AND tsss.user_id IS NULL;

-- 3. Add user_id to technical_sheet_ingredients
ALTER TABLE public.technical_sheet_ingredients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.technical_sheet_ingredients tsi
SET user_id = ts.user_id
FROM public.technical_sheets ts
WHERE tsi.technical_sheet_id = ts.id AND tsi.user_id IS NULL;

-- 4. Add user_id to production_stage_executions
ALTER TABLE public.production_stage_executions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.production_stage_executions pse
SET user_id = p.user_id
FROM public.productions p
WHERE pse.production_id = p.id AND pse.user_id IS NULL;

-- 5. Add user_id to production_step_executions
ALTER TABLE public.production_step_executions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.production_step_executions pste
SET user_id = p.user_id
FROM public.productions p
WHERE pste.production_id = p.id AND pste.user_id IS NULL;

-- 6. Add user_id to sale_product_components
ALTER TABLE public.sale_product_components ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.sale_product_components spc
SET user_id = sp.user_id
FROM public.sale_products sp
WHERE spc.sale_product_id = sp.id AND spc.user_id IS NULL;

-- Make user_id NOT NULL for future inserts (optional but recommended)
-- ALTER TABLE public.technical_sheet_stages ALTER COLUMN user_id SET NOT NULL;
-- ... etc

-- 7. Apply Hierarchical RLS to all fixed tables
DO $$
DECLARE
    t text;
    tables_to_fix text[] := ARRAY[
        'technical_sheet_stages', 
        'technical_sheet_stage_steps', 
        'technical_sheet_ingredients',
        'production_stage_executions',
        'production_step_executions',
        'sale_product_components',
        'item_expiry_dates'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_fix LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop existing policies
        EXECUTE format('DROP POLICY IF EXISTS "Hierarchical Access" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Admins can view and edit all %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view own %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON public.%I', t, t);

        -- Create HIERARCHICAL policies
        -- View Policy
        EXECUTE format('CREATE POLICY "Hierarchical View" ON public.%I FOR SELECT USING (public.check_is_admin() OR user_id = public.get_owner_id())', t);
        
        -- Insert Policy
        EXECUTE format('CREATE POLICY "Hierarchical Insert" ON public.%I FOR INSERT WITH CHECK (public.check_is_admin() OR user_id = public.get_owner_id())', t);
        
        -- Update Policy
        EXECUTE format('CREATE POLICY "Hierarchical Update" ON public.%I FOR UPDATE USING (public.check_is_admin() OR user_id = public.get_owner_id())', t);
        
        -- Delete Policy
        EXECUTE format('CREATE POLICY "Hierarchical Delete" ON public.%I FOR DELETE USING (public.check_is_admin() OR user_id = public.get_owner_id())', t);
    END LOOP;
END $$;
