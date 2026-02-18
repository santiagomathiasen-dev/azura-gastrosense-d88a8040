-- =====================================================
-- Tabela: item_expiry_dates
-- Múltiplas datas de validade por item do estoque
-- =====================================================

CREATE TABLE IF NOT EXISTS item_expiry_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  expiry_date DATE NOT NULL,
  batch_name TEXT,
  quantity NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para queries rápidas por item e por data
CREATE INDEX idx_item_expiry_dates_stock_item ON item_expiry_dates(stock_item_id);
CREATE INDEX idx_item_expiry_dates_expiry ON item_expiry_dates(expiry_date);
CREATE INDEX idx_item_expiry_dates_user ON item_expiry_dates(user_id);

-- RLS
ALTER TABLE item_expiry_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expiry dates"
  ON item_expiry_dates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expiry dates"
  ON item_expiry_dates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expiry dates"
  ON item_expiry_dates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expiry dates"
  ON item_expiry_dates FOR DELETE
  USING (auth.uid() = user_id);
