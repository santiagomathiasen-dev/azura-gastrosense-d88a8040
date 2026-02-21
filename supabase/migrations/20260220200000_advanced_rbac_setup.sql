-- Standardize business_role enum
DO $$
BEGIN
    -- Check if 'admin' is already in business_role, if not, recreate or update
    -- Since we can't easily add to enum in some Postgres versions without migration issues, 
    -- we check and add if missing.
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'business_role' AND n.nspname = 'public') THEN
        CREATE TYPE public.business_role AS ENUM ('admin', 'gestor', 'colaborador');
    ELSE
        -- If it exists, we might need to add missing values
        -- Note: ALTER TYPE ADD VALUE cannot be executed in a transaction block in some environments
        -- But Supabase migration tool handles this usually.
        BEGIN
            ALTER TYPE public.business_role ADD VALUE 'admin';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.business_role ADD VALUE 'gestor';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.business_role ADD VALUE 'colaborador';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END
$$;

-- Ensure profiles table has necessary columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gestor_id UUID REFERENCES public.profiles(id);

-- Update existing profiles to use new roles if they were using old ones
UPDATE public.profiles SET role = 'gestor'::public.business_role WHERE role::text IN ('producao', 'estoque', 'venda', 'teste');

-- Fix get_owner_id to support impersonation context (via session variable if needed, or simply role-based)
-- For now, let's ensure it handles gestor_id correctly
CREATE OR REPLACE FUNCTION public.get_owner_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gestor_id uuid;
    v_role business_role;
BEGIN
    SELECT gestor_id, role INTO v_gestor_id, v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- If Admin, they might be impersonating (we'll handle impersonation via a custom claim or a mapping table later if needed)
    -- For now, Admin sees everything via policies, but for "Add Item", they need an owner.
    -- Default behavior: return self if no gestor_id (meaning they are the top-level owner of their data)
    RETURN COALESCE(v_gestor_id, auth.uid());
END;
$$;

-- Update RLS policies for profiles to allow Admin access
DROP POLICY IF EXISTS "Admins can view and edit all profiles" ON public.profiles;
CREATE POLICY "Admins can view and edit all profiles"
ON public.profiles
FOR ALL
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Update RLS policies for common tables to allow Admin access everywhere
-- This is a generic pattern, should be applied to all relevant tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('profiles', 'user_roles') -- Profiles already handled
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admins have full access on %I" ON public.%I FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = ''admin'')', t, t);
    END LOOP;
END
$$;
