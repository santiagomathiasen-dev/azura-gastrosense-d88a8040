-- Add collaborator-specific columns to profiles to allow unification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pin_hash TEXT,
ADD COLUMN IF NOT EXISTS can_access_dashboard BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_estoque BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_estoque_producao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_fichas BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_producao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_compras BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_finalizados BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_produtos_venda BOOLEAN DEFAULT false;

-- Migrate existing collaborators to profiles (if they have an auth_user_id)
-- Note: This is an idempotent operation
INSERT INTO public.profiles (id, full_name, role, gestor_id, pin_hash, can_access_dashboard, can_access_estoque, can_access_estoque_producao, can_access_fichas, can_access_producao, can_access_compras, can_access_finalizados, can_access_produtos_venda)
SELECT 
    auth_user_id as id, 
    name as full_name, 
    'colaborador'::public.business_role as role, 
    gestor_id, 
    pin_hash, 
    can_access_dashboard, 
    can_access_estoque, 
    can_access_estoque_producao, 
    can_access_fichas, 
    can_access_producao, 
    can_access_compras, 
    can_access_finalizados, 
    can_access_produtos_venda
FROM public.collaborators
WHERE auth_user_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    gestor_id = EXCLUDED.gestor_id,
    pin_hash = EXCLUDED.pin_hash,
    can_access_dashboard = EXCLUDED.can_access_dashboard,
    can_access_estoque = EXCLUDED.can_access_estoque,
    can_access_estoque_producao = EXCLUDED.can_access_estoque_producao,
    can_access_fichas = EXCLUDED.can_access_fichas,
    can_access_producao = EXCLUDED.can_access_producao,
    can_access_compras = EXCLUDED.can_access_compras,
    can_access_finalizados = EXCLUDED.can_access_finalizados,
    can_access_produtos_venda = EXCLUDED.can_access_produtos_venda;

-- Update types.ts will be done in the next step
