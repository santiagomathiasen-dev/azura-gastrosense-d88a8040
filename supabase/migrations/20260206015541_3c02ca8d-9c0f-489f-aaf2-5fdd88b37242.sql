-- Create a unified losses table to track all losses from different sources
CREATE TABLE public.losses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('stock_item', 'sale_product', 'finished_production')),
  source_id UUID NOT NULL,
  source_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidade',
  estimated_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.losses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view accessible losses"
ON public.losses FOR SELECT
USING (can_access_owner_data(user_id));

CREATE POLICY "Users can insert losses for their org"
ON public.losses FOR INSERT
WITH CHECK (user_id = get_owner_id());

CREATE POLICY "Users can update accessible losses"
ON public.losses FOR UPDATE
USING (can_access_owner_data(user_id));

CREATE POLICY "Users can delete accessible losses"
ON public.losses FOR DELETE
USING (can_access_owner_data(user_id));

-- Create index for faster queries
CREATE INDEX idx_losses_user_created ON public.losses(user_id, created_at DESC);
CREATE INDEX idx_losses_source ON public.losses(source_type, source_id);