-- 1. Add missing permission columns to profiles and collaborators
-- Adding: financeiro, relatorios
DO $$
BEGIN
    -- profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'can_access_financeiro') THEN
        ALTER TABLE public.profiles ADD COLUMN can_access_financeiro BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'can_access_relatorios') THEN
        ALTER TABLE public.profiles ADD COLUMN can_access_relatorios BOOLEAN DEFAULT false;
    END IF;

    -- collaborators
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collaborators' AND column_name = 'can_access_financeiro') THEN
        ALTER TABLE public.collaborators ADD COLUMN can_access_financeiro BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collaborators' AND column_name = 'can_access_relatorios') THEN
        ALTER TABLE public.collaborators ADD COLUMN can_access_relatorios BOOLEAN DEFAULT false;
    END IF;
END
$$;

-- 2. Ensure Santiago has a profile record
INSERT INTO public.profiles (id, email, full_name, role, status_pagamento, status, can_access_dashboard, can_access_estoque, can_access_fichas, can_access_producao, can_access_compras, can_access_finalizados, can_access_produtos_venda, can_access_financeiro, can_access_relatorios)
VALUES ('b3e49b7e-3979-4c0b-b7d6-ef98eb3d739d', 'santiago.aloom@gmail.com', 'Santiago Mathiasen', 'admin', true, 'ativo', true, true, true, true, true, true, true, true, true)
ON CONFLICT (id) DO UPDATE SET 
    role = 'admin',
    status = 'ativo',
    status_pagamento = true,
    can_access_dashboard = true,
    can_access_estoque = true,
    can_access_fichas = true,
    can_access_producao = true,
    can_access_compras = true,
    can_access_finalizados = true,
    can_access_produtos_venda = true,
    can_access_financeiro = true,
    can_access_relatorios = true;

-- 3. Update existing admins/owners to have these permissions enabled by default if not already
UPDATE public.profiles 
SET can_access_financeiro = true, can_access_relatorios = true 
WHERE role = 'admin';
