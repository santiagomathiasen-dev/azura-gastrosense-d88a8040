-- ============================================
-- ADIÇÃO DE CAMPOS FINANCEIROS GRANULARES (OPEX)
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Campos para technical_sheets
ALTER TABLE technical_sheets
  ADD COLUMN IF NOT EXISTS labor_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS energy_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_costs NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN technical_sheets.labor_cost IS 'Custo estimado de mão de obra para esta ficha';
COMMENT ON COLUMN technical_sheets.energy_cost IS 'Custo estimado de energia/gás para esta ficha';
COMMENT ON COLUMN technical_sheets.other_costs IS 'Outros custos operacionais (embalagem extra, taxas específicas)';

-- 2. Campos para sale_products
ALTER TABLE sale_products
  ADD COLUMN IF NOT EXISTS labor_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS energy_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_costs NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN sale_products.labor_cost IS 'Custo estimado de mão de obra direta para o produto final';
COMMENT ON COLUMN sale_products.energy_cost IS 'Custo estimado de energia para o produto final';
COMMENT ON COLUMN sale_products.other_costs IS 'Outros custos operacionais individuais do produto';
