-- ========================================
-- FASE 1: FORNECEDORES + VALIDADE
-- ========================================

-- Criar tabela de fornecedores
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  average_delivery_days INTEGER DEFAULT 3,
  quality_rating INTEGER DEFAULT 3 CHECK (quality_rating >= 1 AND quality_rating <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policies for suppliers
CREATE POLICY "Users can view their own suppliers"
ON public.suppliers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suppliers"
ON public.suppliers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suppliers"
ON public.suppliers FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key to stock_items for supplier
ALTER TABLE public.stock_items
ADD CONSTRAINT stock_items_supplier_fkey
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- ========================================
-- FASE 3: PRODUÇÃO + FICHAS TÉCNICAS
-- ========================================

-- Enum para status de produção
CREATE TYPE public.production_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

-- Enum para período de produção
CREATE TYPE public.production_period AS ENUM ('day', 'week', 'month', 'year', 'custom');

-- Tabela de fichas técnicas (receitas com custo)
CREATE TABLE public.technical_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  yield_quantity NUMERIC NOT NULL DEFAULT 1,
  yield_unit TEXT NOT NULL DEFAULT 'unidade',
  preparation_time INTEGER, -- em minutos
  preparation_method TEXT,
  total_cost NUMERIC DEFAULT 0,
  cost_per_unit NUMERIC DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.technical_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own technical sheets"
ON public.technical_sheets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own technical sheets"
ON public.technical_sheets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own technical sheets"
ON public.technical_sheets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own technical sheets"
ON public.technical_sheets FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_technical_sheets_updated_at
BEFORE UPDATE ON public.technical_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ingredientes das fichas técnicas
CREATE TABLE public.technical_sheet_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technical_sheet_id UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.technical_sheet_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sheet ingredients"
ON public.technical_sheet_ingredients FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.technical_sheets ts
  WHERE ts.id = technical_sheet_id AND ts.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own sheet ingredients"
ON public.technical_sheet_ingredients FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.technical_sheets ts
  WHERE ts.id = technical_sheet_id AND ts.user_id = auth.uid()
));

CREATE POLICY "Users can update their own sheet ingredients"
ON public.technical_sheet_ingredients FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.technical_sheets ts
  WHERE ts.id = technical_sheet_id AND ts.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own sheet ingredients"
ON public.technical_sheet_ingredients FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.technical_sheets ts
  WHERE ts.id = technical_sheet_id AND ts.user_id = auth.uid()
));

-- Tabela de produções
CREATE TABLE public.productions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  technical_sheet_id UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  planned_quantity NUMERIC NOT NULL DEFAULT 1,
  actual_quantity NUMERIC,
  period_type production_period NOT NULL DEFAULT 'day',
  scheduled_date DATE NOT NULL,
  scheduled_end_date DATE,
  status production_status NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own productions"
ON public.productions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own productions"
ON public.productions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own productions"
ON public.productions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own productions"
ON public.productions FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_productions_updated_at
BEFORE UPDATE ON public.productions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- FASE 4: LISTA DE COMPRAS
-- ========================================

CREATE TYPE public.purchase_status AS ENUM ('pending', 'ordered', 'delivered', 'cancelled');

CREATE TABLE public.purchase_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  suggested_quantity NUMERIC NOT NULL,
  ordered_quantity NUMERIC,
  status purchase_status NOT NULL DEFAULT 'pending',
  order_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchase items"
ON public.purchase_list_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchase items"
ON public.purchase_list_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchase items"
ON public.purchase_list_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own purchase items"
ON public.purchase_list_items FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_purchase_list_items_updated_at
BEFORE UPDATE ON public.purchase_list_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Calendário de pedidos (dias fixos)
CREATE TABLE public.purchase_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  order_day BOOLEAN NOT NULL DEFAULT true, -- true = dia de pedido, false = dia de entrega
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchase schedule"
ON public.purchase_schedule FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchase schedule"
ON public.purchase_schedule FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchase schedule"
ON public.purchase_schedule FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own purchase schedule"
ON public.purchase_schedule FOR DELETE
USING (auth.uid() = user_id);