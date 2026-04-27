-- ============================================
-- MÓDULO DE PRODUÇÃO BASEADA EM PREVISÃO DE VENDAS
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Novo enum para status das ordens de previsão
DO $$ BEGIN
  CREATE TYPE forecast_order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Novos campos em technical_sheets (lead time e validade)
ALTER TABLE technical_sheets
  ADD COLUMN IF NOT EXISTS shelf_life_hours INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_time_hours INTEGER DEFAULT NULL;

COMMENT ON COLUMN technical_sheets.shelf_life_hours IS 'Validade do produto em horas após produção (ex: 72 = 3 dias)';
COMMENT ON COLUMN technical_sheets.lead_time_hours IS 'Antecedência de preparo em horas antes do consumo (ex: 24 = precisa produzir 1 dia antes)';

-- 3. Tabela: Previsão de Vendas
CREATE TABLE IF NOT EXISTS sales_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sale_product_id UUID NOT NULL REFERENCES sale_products(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  forecasted_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_date, sale_product_id)
);

-- 4. Tabela: Ordens de Produção Geradas pela Explosão
CREATE TABLE IF NOT EXISTS forecast_production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  forecast_id UUID REFERENCES sales_forecasts(id) ON DELETE SET NULL,
  technical_sheet_id UUID NOT NULL REFERENCES technical_sheets(id) ON DELETE CASCADE,
  production_date DATE NOT NULL,
  target_consumption_date DATE NOT NULL,
  required_quantity NUMERIC NOT NULL DEFAULT 0,
  existing_stock NUMERIC NOT NULL DEFAULT 0,
  net_quantity NUMERIC NOT NULL DEFAULT 0,
  praca production_praca DEFAULT 'praca_quente',
  status forecast_order_status NOT NULL DEFAULT 'pending',
  linked_production_id UUID REFERENCES productions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_forecasts_user_date
  ON sales_forecasts(user_id, target_date);

CREATE INDEX IF NOT EXISTS idx_forecast_orders_user_date_praca
  ON forecast_production_orders(user_id, production_date, praca);

CREATE INDEX IF NOT EXISTS idx_forecast_orders_status
  ON forecast_production_orders(status);

-- 6. RLS (Row Level Security)
ALTER TABLE sales_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_production_orders ENABLE ROW LEVEL SECURITY;

-- Políticas para sales_forecasts
CREATE POLICY "Users can view own forecasts"
  ON sales_forecasts FOR SELECT
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can insert own forecasts"
  ON sales_forecasts FOR INSERT
  WITH CHECK (can_access_owner_data(user_id));

CREATE POLICY "Users can update own forecasts"
  ON sales_forecasts FOR UPDATE
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can delete own forecasts"
  ON sales_forecasts FOR DELETE
  USING (can_access_owner_data(user_id));

-- Políticas para forecast_production_orders
CREATE POLICY "Users can view own forecast orders"
  ON forecast_production_orders FOR SELECT
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can insert own forecast orders"
  ON forecast_production_orders FOR INSERT
  WITH CHECK (can_access_owner_data(user_id));

CREATE POLICY "Users can update own forecast orders"
  ON forecast_production_orders FOR UPDATE
  USING (can_access_owner_data(user_id));

CREATE POLICY "Users can delete own forecast orders"
  ON forecast_production_orders FOR DELETE
  USING (can_access_owner_data(user_id));

-- 7. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_forecast_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_forecast_orders_updated_at ON forecast_production_orders;
CREATE TRIGGER trigger_forecast_orders_updated_at
  BEFORE UPDATE ON forecast_production_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_forecast_orders_updated_at();
