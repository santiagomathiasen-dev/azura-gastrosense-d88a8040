-- Add waste_factor column to stock_items (percentage, e.g., 10 = 10% waste)
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS waste_factor numeric DEFAULT 0;

-- Create production_stock table (production stock separate from central stock)
CREATE TABLE public.production_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, stock_item_id)
);

-- Enable RLS on production_stock
ALTER TABLE public.production_stock ENABLE ROW LEVEL SECURITY;

-- RLS policies for production_stock
CREATE POLICY "Users can view their own production stock"
ON public.production_stock FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own production stock"
ON public.production_stock FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own production stock"
ON public.production_stock FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own production stock"
ON public.production_stock FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_production_stock_updated_at
BEFORE UPDATE ON public.production_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create stock_transfers table (track transfers between central and production)
CREATE TABLE public.stock_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to_production', 'to_central')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on stock_transfers
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_transfers
CREATE POLICY "Users can view their own stock transfers"
ON public.stock_transfers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock transfers"
ON public.stock_transfers FOR INSERT
WITH CHECK (auth.uid() = user_id);