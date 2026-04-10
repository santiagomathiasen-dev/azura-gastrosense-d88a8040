-- =============================================================================
-- FASE 3 — Remoção das colunas financeiras de technical_sheets
--
-- ATENÇÃO: Execute SOMENTE após:
--   1. Rodar FASE3_sheet_costs_migration.sql
--   2. Verificar que os dados estão corretos em sheet_costs
--   3. Confirmar que o frontend está lendo de sheet_costs (não de technical_sheets)
--
-- ROLLBACK: Não há rollback automático após o DROP. Faça backup antes.
-- =============================================================================

ALTER TABLE public.technical_sheets
    DROP COLUMN IF EXISTS labor_cost,
    DROP COLUMN IF EXISTS energy_cost,
    DROP COLUMN IF EXISTS other_costs,
    DROP COLUMN IF EXISTS markup,
    DROP COLUMN IF EXISTS target_price,
    DROP COLUMN IF EXISTS total_cost,
    DROP COLUMN IF EXISTS cost_per_unit;
