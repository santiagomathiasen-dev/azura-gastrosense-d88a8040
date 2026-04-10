-- =============================================================================
-- FASE 5 -- Remocao da FK circular stock_movements.related_production_id
-- Cria a tabela de juncao production_stock_events e migra dados existentes.
--
-- PROBLEMA:
--   stock_movements.related_production_id -> productions (FK circular)
--   Isso cria dependencia ciclica: productions -> stock_movements -> productions
--   Dificulta deletes, migracao de dados e isolamento do modulo OPS.
--
-- SOLUCAO:
--   Tabela de juncao production_stock_events que liga stock_movements
--   a productions sem colocar FK em stock_movements.
--
-- INSTRUCOES:
--   1. Execute este script no SQL Editor do Supabase
--   2. Verifique os dados migrados (bloco de verificacao no final)
--   3. SÓ DEPOIS de confirmar, rode FASE5_drop_fk.sql para remover a coluna antiga
--
-- ROLLBACK (antes do DROP):
--   DROP TABLE IF EXISTS production_stock_events CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CRIAR TABELA production_stock_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_stock_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id       UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
    stock_movement_id   UUID NOT NULL REFERENCES public.stock_movements(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Garante que cada movimento pertence a exatamente uma producao
    UNIQUE (stock_movement_id)
);

-- Indice para busca por producao (ex: "todos os movimentos desta producao")
CREATE INDEX IF NOT EXISTS idx_pse_production_id
    ON public.production_stock_events(production_id);

-- Indice para busca por user_id (RLS + queries filtradas por owner)
CREATE INDEX IF NOT EXISTS idx_pse_user_id
    ON public.production_stock_events(user_id);


-- -----------------------------------------------------------------------------
-- 2. HABILITAR RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.production_stock_events ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 3. POLITICAS RLS (idempotentes)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pse: users read own" ON public.production_stock_events;
CREATE POLICY "pse: users read own"
    ON public.production_stock_events FOR SELECT
    USING (user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.owner_id = production_stock_events.user_id
              AND profiles.id = auth.uid()
        ));

DROP POLICY IF EXISTS "pse: users insert own" ON public.production_stock_events;
CREATE POLICY "pse: users insert own"
    ON public.production_stock_events FOR INSERT
    WITH CHECK (user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.owner_id = production_stock_events.user_id
              AND profiles.id = auth.uid()
        ));

DROP POLICY IF EXISTS "pse: users delete own" ON public.production_stock_events;
CREATE POLICY "pse: users delete own"
    ON public.production_stock_events FOR DELETE
    USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 4. MIGRAR DADOS EXISTENTES
--    Copia os links de stock_movements.related_production_id para a nova tabela.
--    Usa ON CONFLICT DO NOTHING para ser idempotente (pode ser re-executado).
-- -----------------------------------------------------------------------------
INSERT INTO public.production_stock_events (
    production_id,
    stock_movement_id,
    user_id,
    created_at
)
SELECT
    sm.related_production_id,
    sm.id,
    sm.user_id,
    sm.created_at
FROM public.stock_movements sm
WHERE sm.related_production_id IS NOT NULL
ON CONFLICT (stock_movement_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 5. VERIFICACAO (rodar manualmente para confirmar antes do DROP)
-- -----------------------------------------------------------------------------
-- Total de movimentos com related_production_id (origem):
-- SELECT COUNT(*) AS total_origem
-- FROM public.stock_movements
-- WHERE related_production_id IS NOT NULL;

-- Total migrado para production_stock_events:
-- SELECT COUNT(*) AS total_migrado FROM public.production_stock_events;

-- Deve ser igual. Se diferente, alguma FK falhou (producao deletada antes do migrar).
-- Ver quais nao migraram:
-- SELECT sm.id, sm.related_production_id
-- FROM public.stock_movements sm
-- LEFT JOIN public.production_stock_events pse ON pse.stock_movement_id = sm.id
-- WHERE sm.related_production_id IS NOT NULL AND pse.id IS NULL;
