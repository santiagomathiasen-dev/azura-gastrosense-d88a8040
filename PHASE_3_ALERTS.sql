-- Phase 3: Intelligent Alerts
-- Table to track preparation failures due to missing stock

CREATE TABLE IF NOT EXISTS public.preparation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  missing_component_id UUID NOT NULL, -- Can be stock_item_id or finished_production_id
  missing_component_type TEXT NOT NULL, -- 'stock_item' or 'finished_production'
  missing_quantity NUMERIC NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.preparation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alerts"
  ON public.preparation_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts"
  ON public.preparation_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
  ON public.preparation_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
  ON public.preparation_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE public.preparation_alerts IS 'Tracks failed preparation attempts due to insufficient stock';
COMMENT ON COLUMN public.preparation_alerts.sale_product_id IS 'The product that could not be prepared';
COMMENT ON COLUMN public.preparation_alerts.missing_component_id IS 'ID of the missing ingredient or production';
