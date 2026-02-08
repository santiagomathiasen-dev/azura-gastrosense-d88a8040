-- Table for finished productions stock (grouped by technical sheet)
CREATE TABLE public.finished_productions_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  technical_sheet_id UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unidade',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, technical_sheet_id)
);

-- Enable RLS
ALTER TABLE public.finished_productions_stock ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own finished productions stock"
  ON public.finished_productions_stock FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own finished productions stock"
  ON public.finished_productions_stock FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own finished productions stock"
  ON public.finished_productions_stock FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own finished productions stock"
  ON public.finished_productions_stock FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_finished_productions_stock_updated_at
  BEFORE UPDATE ON public.finished_productions_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table for sale products (composite products for selling)
CREATE TABLE public.sale_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sale_price NUMERIC DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_products ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sale products"
  ON public.sale_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sale products"
  ON public.sale_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sale products"
  ON public.sale_products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sale products"
  ON public.sale_products FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_sale_products_updated_at
  BEFORE UPDATE ON public.sale_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table for sale product components (can be: finished_production, stock_item, or sale_product)
CREATE TYPE public.sale_component_type AS ENUM ('finished_production', 'stock_item', 'sale_product');

CREATE TABLE public.sale_product_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  component_type public.sale_component_type NOT NULL,
  -- Reference to the component (finished_productions_stock.technical_sheet_id, stock_items.id, or sale_products.id)
  component_id UUID NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_product_components ENABLE ROW LEVEL SECURITY;

-- RLS policies (based on parent sale_product ownership)
CREATE POLICY "Users can view their own sale product components"
  ON public.sale_product_components FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sale_products sp
    WHERE sp.id = sale_product_components.sale_product_id
    AND sp.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own sale product components"
  ON public.sale_product_components FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sale_products sp
    WHERE sp.id = sale_product_components.sale_product_id
    AND sp.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own sale product components"
  ON public.sale_product_components FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sale_products sp
    WHERE sp.id = sale_product_components.sale_product_id
    AND sp.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own sale product components"
  ON public.sale_product_components FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sale_products sp
    WHERE sp.id = sale_product_components.sale_product_id
    AND sp.user_id = auth.uid()
  ));

-- Table for tracking sales (to record quantity sold and trigger stock deductions)
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  quantity_sold NUMERIC NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sales"
  ON public.sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales"
  ON public.sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales"
  ON public.sales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales"
  ON public.sales FOR DELETE
  USING (auth.uid() = user_id);