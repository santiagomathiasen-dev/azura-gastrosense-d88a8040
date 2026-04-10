-- =============================================================================
-- FASE 5 — Remocao da coluna related_production_id de stock_movements
--
-- PREREQ OBRIGATORIO:
--   1. FASE5_production_stock_events.sql ja foi executado
--   2. Os dados foram verificados (contagens batem)
--   3. O codigo ja foi atualizado para usar production_stock_events
--      (nenhuma query mais usa related_production_id)
--
-- ROLLBACK: Nao ha rollback simples apos este script.
--           Faca backup ou use Supabase branching antes de executar.
-- =============================================================================

-- Remover a FK constraint (se existir como constraint nomeada)
-- Adapte o nome da constraint se diferente no seu banco:
-- ALTER TABLE public.stock_movements
--     DROP CONSTRAINT IF EXISTS stock_movements_related_production_id_fkey;

-- Remover a coluna
ALTER TABLE public.stock_movements
    DROP COLUMN IF EXISTS related_production_id;
