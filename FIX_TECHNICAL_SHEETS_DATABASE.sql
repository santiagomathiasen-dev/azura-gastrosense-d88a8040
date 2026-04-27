-- 1. Criar o tipo enum para tipo de produção (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_type') THEN
        CREATE TYPE public.production_type AS ENUM ('insumo', 'final');
    END IF;
END $$;

-- 2. Garantir que as colunas necessárias existem na technical_sheets
ALTER TABLE public.technical_sheets 
ADD COLUMN IF NOT EXISTS production_type public.production_type NOT NULL DEFAULT 'final',
ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC DEFAULT 0;

-- 3. Garantir que preparation_time e yield existem (foram adicionados em sessões anteriores)
ALTER TABLE public.technical_sheets 
ADD COLUMN IF NOT EXISTS preparation_time INTEGER,
ADD COLUMN IF NOT EXISTS yield_quantity NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS yield_unit TEXT DEFAULT 'un';

-- 4. Garantir que a tabela de etapas existe
CREATE TABLE IF NOT EXISTS public.technical_sheet_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technical_sheet_id UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Garantir que technical_sheet_ingredients tem a coluna stage_id
ALTER TABLE public.technical_sheet_ingredients
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.technical_sheet_stages(id) ON DELETE SET NULL;

-- 6. Habilitar RLS nas etapas (se for nova)
ALTER TABLE public.technical_sheet_stages ENABLE ROW LEVEL SECURITY;

-- 7. Recriar políticas de RLS para evitar erros de duplicidade ou falta de permissão
DROP POLICY IF EXISTS "Users can view their own sheet stages" ON public.technical_sheet_stages;
CREATE POLICY "Users can view their own sheet stages"
ON public.technical_sheet_stages FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND can_access_owner_data(ts.user_id)
));

DROP POLICY IF EXISTS "Users can insert their own sheet stages" ON public.technical_sheet_stages;
CREATE POLICY "Users can insert their own sheet stages"
ON public.technical_sheet_stages FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND ts.user_id = get_owner_id()
));

DROP POLICY IF EXISTS "Users can update their own sheet stages" ON public.technical_sheet_stages;
CREATE POLICY "Users can update their own sheet stages"
ON public.technical_sheet_stages FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND can_access_owner_data(ts.user_id)
));

DROP POLICY IF EXISTS "Users can delete their own sheet stages" ON public.technical_sheet_stages;
CREATE POLICY "Users can delete their own sheet stages"
ON public.technical_sheet_stages FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND can_access_owner_data(ts.user_id)
));
