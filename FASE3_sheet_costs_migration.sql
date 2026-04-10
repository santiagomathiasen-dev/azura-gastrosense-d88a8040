-- =============================================================================
-- FASE 3 — Separação de campos financeiros de technical_sheets
-- Cria a tabela sheet_costs e migra os dados existentes.
--
-- INSTRUÇÕES:
--   1. Execute este script no SQL Editor do Supabase (ou via CLI: supabase db push)
--   2. Verifique os dados migrados: SELECT * FROM sheet_costs LIMIT 10;
--   3. SÓ DEPOIS de confirmar os dados, rode FASE3_drop_columns.sql
--      para remover as colunas antigas de technical_sheets.
--
-- ROLLBACK (se necessário antes do DROP):
--   DROP TABLE IF EXISTS sheet_costs CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CRIAR TABELA sheet_costs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sheet_costs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technical_sheet_id  UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Campos financeiros extraídos de technical_sheets
    labor_cost          NUMERIC(10, 4) NOT NULL DEFAULT 0,
    energy_cost         NUMERIC(10, 4) NOT NULL DEFAULT 0,
    other_costs         NUMERIC(10, 4) NOT NULL DEFAULT 0,
    markup              NUMERIC(10, 4) NOT NULL DEFAULT 0,
    target_price        NUMERIC(10, 4),
    total_cost          NUMERIC(10, 4),
    cost_per_unit       NUMERIC(10, 4),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Uma ficha só pode ter um registro de custos
    CONSTRAINT sheet_costs_technical_sheet_id_unique UNIQUE (technical_sheet_id)
);

-- Índice para busca por user_id (RLS + listagem)
CREATE INDEX IF NOT EXISTS sheet_costs_user_id_idx   ON public.sheet_costs(user_id);
CREATE INDEX IF NOT EXISTS sheet_costs_sheet_id_idx  ON public.sheet_costs(technical_sheet_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sheet_costs_updated_at ON public.sheet_costs;
CREATE TRIGGER sheet_costs_updated_at
    BEFORE UPDATE ON public.sheet_costs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (espelha a política de technical_sheets)
-- -----------------------------------------------------------------------------
ALTER TABLE public.sheet_costs ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS antes de criar (torna o script idempotente)
DROP POLICY IF EXISTS "sheet_costs: users read own"   ON public.sheet_costs;
DROP POLICY IF EXISTS "sheet_costs: users insert own" ON public.sheet_costs;
DROP POLICY IF EXISTS "sheet_costs: users update own" ON public.sheet_costs;
DROP POLICY IF EXISTS "sheet_costs: users delete own" ON public.sheet_costs;

CREATE POLICY "sheet_costs: users read own"
    ON public.sheet_costs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "sheet_costs: users insert own"
    ON public.sheet_costs FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "sheet_costs: users update own"
    ON public.sheet_costs FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "sheet_costs: users delete own"
    ON public.sheet_costs FOR DELETE
    USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. MIGRAR DADOS EXISTENTES de technical_sheets → sheet_costs
-- -----------------------------------------------------------------------------
INSERT INTO public.sheet_costs (
    technical_sheet_id,
    user_id,
    labor_cost,
    energy_cost,
    other_costs,
    markup,
    target_price,
    total_cost,
    cost_per_unit,
    created_at,
    updated_at
)
SELECT
    id                              AS technical_sheet_id,
    user_id,
    COALESCE(labor_cost, 0)         AS labor_cost,
    COALESCE(energy_cost, 0)        AS energy_cost,
    COALESCE(other_costs, 0)        AS other_costs,
    COALESCE(markup, 0)             AS markup,
    target_price,
    total_cost,
    cost_per_unit,
    created_at,
    updated_at
FROM public.technical_sheets
-- Ignora fichas que já foram migradas (execução idempotente)
ON CONFLICT (technical_sheet_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. VERIFICAÇÃO
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_sheets  INT;
    v_costs   INT;
BEGIN
    SELECT COUNT(*) INTO v_sheets FROM public.technical_sheets;
    SELECT COUNT(*) INTO v_costs  FROM public.sheet_costs;
    RAISE NOTICE 'technical_sheets: % rows | sheet_costs migrated: % rows', v_sheets, v_costs;
    IF v_costs < v_sheets THEN
        RAISE WARNING 'Algumas fichas nao foram migradas. Verifique manualmente.';
    END IF;
END $$;
