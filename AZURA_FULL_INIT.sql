-- ========================================
-- PRE-REQUISITOS: ENUMS, TABELAS E FUNCOES
-- ========================================

-- Create business_role enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'business_role' AND n.nspname = 'public') THEN
        CREATE TYPE public.business_role AS ENUM ('gestor', 'producao', 'estoque', 'venda', 'teste');
    END IF;
END
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  gestor_id UUID REFERENCES public.profiles(id),
  role public.business_role NOT NULL DEFAULT 'gestor',
  status_pagamento BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: get_owner_id
CREATE OR REPLACE FUNCTION public.get_owner_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gestor_id uuid;
BEGIN
    SELECT gestor_id INTO v_gestor_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_gestor_id, auth.uid());
END;
$$;

-- Helper function: can_access_owner_data
CREATE OR REPLACE FUNCTION public.can_access_owner_data(data_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN get_owner_id() = data_owner_id;
END;
$$;

-- Helper function: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS business_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role business_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN v_role;
END;
$$;

-- Basic RLS policies for profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own profile' AND polrelid = 'public.profiles'::regclass) THEN
        CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own profile' AND polrelid = 'public.profiles'::regclass) THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
END
$$;


-- Enum para categorias de ingredientes
CREATE TYPE public.stock_category AS ENUM (
  'laticinios',
  'secos_e_graos',
  'hortifruti',
  'carnes_e_peixes',
  'embalagens',
  'limpeza',
  'outros'
);

-- Enum para unidades
CREATE TYPE public.stock_unit AS ENUM (
  'kg',
  'g',
  'L',
  'ml',
  'unidade',
  'caixa',
  'dz'
);

-- Enum para tipo de movimentaÃ§Ã£o
CREATE TYPE public.movement_type AS ENUM (
  'entry',
  'exit',
  'adjustment'
);

-- Enum para origem da movimentaÃ§Ã£o
CREATE TYPE public.movement_source AS ENUM (
  'manual',
  'production',
  'audio',
  'image'
);

-- Tabela de itens de estoque
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category stock_category NOT NULL DEFAULT 'outros',
  unit stock_unit NOT NULL DEFAULT 'unidade',
  current_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  minimum_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  expiration_date DATE,
  supplier_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentaÃ§Ãµes de estoque
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type movement_type NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  source movement_source NOT NULL DEFAULT 'manual',
  related_production_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ãndices para performance
CREATE INDEX idx_stock_items_user_id ON public.stock_items(user_id);
CREATE INDEX idx_stock_items_category ON public.stock_items(category);
CREATE INDEX idx_stock_movements_stock_item_id ON public.stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_user_id ON public.stock_movements(user_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- Enable RLS
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies para stock_items
CREATE POLICY "Users can view their own stock items"
  ON public.stock_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock items"
  ON public.stock_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stock items"
  ON public.stock_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stock items"
  ON public.stock_items FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para stock_movements
CREATE POLICY "Users can view their own stock movements"
  ON public.stock_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_stock_items_updated_at
  BEFORE UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- FunÃ§Ã£o para atualizar quantidade de estoque apÃ³s movimentaÃ§Ã£o
CREATE OR REPLACE FUNCTION public.update_stock_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'entry' THEN
    UPDATE public.stock_items
    SET current_quantity = current_quantity + NEW.quantity
    WHERE id = NEW.stock_item_id;
  ELSIF NEW.type = 'exit' THEN
    UPDATE public.stock_items
    SET current_quantity = GREATEST(0, current_quantity - NEW.quantity)
    WHERE id = NEW.stock_item_id;
  ELSIF NEW.type = 'adjustment' THEN
    UPDATE public.stock_items
    SET current_quantity = NEW.quantity
    WHERE id = NEW.stock_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_stock_quantity
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_quantity();

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
-- FASE 3: PRODUÃ‡ÃƒO + FICHAS TÃ‰CNICAS
-- ========================================

-- Enum para status de produÃ§Ã£o
CREATE TYPE public.production_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled', 'paused');

-- Enum para perÃ­odo de produÃ§Ã£o
CREATE TYPE public.production_period AS ENUM ('day', 'week', 'month', 'year', 'custom');

-- Tabela de fichas tÃ©cnicas (receitas com custo)
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
  minimum_stock NUMERIC DEFAULT 0,
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

-- Ingredientes das fichas tÃ©cnicas
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

-- Tabela de produÃ§Ãµes
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

-- CalendÃ¡rio de pedidos (dias fixos)
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

-- Fix SECURITY DEFINER function to validate ownership before updating stock quantities
-- This prevents users from manipulating stock items they don't own

CREATE OR REPLACE FUNCTION public.update_stock_quantity()
RETURNS TRIGGER AS $$
DECLARE
  item_user_id UUID;
BEGIN
  -- Verify stock_item exists and get its owner
  SELECT user_id INTO item_user_id 
  FROM public.stock_items 
  WHERE id = NEW.stock_item_id;
  
  IF item_user_id IS NULL THEN
    RAISE EXCEPTION 'Stock item not found';
  END IF;
  
  -- Verify the stock item belongs to the same user as the movement
  IF item_user_id != NEW.user_id THEN
    RAISE EXCEPTION 'Cannot update stock item owned by different user';
  END IF;
  
  -- Proceed with update only if ownership matches
  IF NEW.type = 'entry' THEN
    UPDATE public.stock_items
    SET current_quantity = current_quantity + NEW.quantity
    WHERE id = NEW.stock_item_id AND user_id = NEW.user_id;
  ELSIF NEW.type = 'exit' THEN
    UPDATE public.stock_items
    SET current_quantity = GREATEST(0, current_quantity - NEW.quantity)
    WHERE id = NEW.stock_item_id AND user_id = NEW.user_id;
  ELSIF NEW.type = 'adjustment' THEN
    UPDATE public.stock_items
    SET current_quantity = NEW.quantity
    WHERE id = NEW.stock_item_id AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add unit_price column to stock_items table for ingredient pricing
ALTER TABLE public.stock_items 
ADD COLUMN unit_price numeric DEFAULT 0;

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

-- Add ready_quantity column to sale_products
ALTER TABLE public.sale_products 
ADD COLUMN ready_quantity numeric NOT NULL DEFAULT 0;

-- Create app_role enum for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create stock_requests table for request workflow
CREATE TABLE public.stock_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  requested_quantity NUMERIC NOT NULL,
  delivered_quantity NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own stock requests" 
ON public.stock_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock requests" 
ON public.stock_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stock requests" 
ON public.stock_requests 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stock requests" 
ON public.stock_requests 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_stock_requests_updated_at
BEFORE UPDATE ON public.stock_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for collaborator accounts (sub-logins with PIN)
CREATE TABLE public.collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  pin_hash text, -- NULL until collaborator sets their PIN on first login
  is_active boolean NOT NULL DEFAULT true,
  -- Permissions: which pages the collaborator can access
  can_access_dashboard boolean NOT NULL DEFAULT true,
  can_access_estoque boolean NOT NULL DEFAULT false,
  can_access_estoque_producao boolean NOT NULL DEFAULT false,
  can_access_fichas boolean NOT NULL DEFAULT false,
  can_access_producao boolean NOT NULL DEFAULT false,
  can_access_compras boolean NOT NULL DEFAULT false,
  can_access_finalizados boolean NOT NULL DEFAULT false,
  can_access_produtos_venda boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;

-- Policies: Only gestors can manage their collaborators
CREATE POLICY "Gestors can view their own collaborators"
  ON public.collaborators FOR SELECT
  USING (gestor_id = auth.uid());

CREATE POLICY "Gestors can insert their own collaborators"
  ON public.collaborators FOR INSERT
  WITH CHECK (gestor_id = auth.uid());

CREATE POLICY "Gestors can update their own collaborators"
  ON public.collaborators FOR UPDATE
  USING (gestor_id = auth.uid());

CREATE POLICY "Gestors can delete their own collaborators"
  ON public.collaborators FOR DELETE
  USING (gestor_id = auth.uid());

-- Trigger to update updated_at
CREATE TRIGGER update_collaborators_updated_at
  BEFORE UPDATE ON public.collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_collaborators_gestor_id ON public.collaborators(gestor_id);
CREATE INDEX idx_collaborators_active ON public.collaborators(is_active) WHERE is_active = true;

-- Allow public read access to collaborators for login flow (only active ones)
CREATE POLICY "Anyone can view active collaborators for login"
  ON public.collaborators FOR SELECT
  USING (is_active = true);

-- Allow collaborators to update their own PIN
CREATE POLICY "Collaborators can update their own PIN"
  ON public.collaborators FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Collaborators can update their own PIN" ON public.collaborators;

-- Create a more restrictive policy that only allows updating PIN (and only if it's null - first time setup)
-- This is still somewhat permissive but necessary for the unauthenticated PIN setup flow
-- The risk is minimal since:
-- 1. Only the pin_hash field can be meaningfully updated (other updates require gestor auth)
-- 2. The collaborator ID must be known beforehand
CREATE POLICY "Anyone can set PIN on first access"
  ON public.collaborators FOR UPDATE
  USING (pin_hash IS NULL)
  WITH CHECK (pin_hash IS NOT NULL);

-- Remove the "set PIN on first access" policy since PIN is now set during creation
DROP POLICY IF EXISTS "Anyone can set PIN on first access" ON public.collaborators;

-- The gestor can already update their collaborators (including PIN) via the existing policy
-- "Gestors can update their own collaborators"

-- Add auth_user_id column to link collaborators to Supabase Auth users
ALTER TABLE public.collaborators
ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add unique constraint to prevent multiple collaborators linking to same auth user
ALTER TABLE public.collaborators
ADD CONSTRAINT collaborators_auth_user_id_key UNIQUE (auth_user_id);

-- Enable realtime for all main data tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.technical_sheets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.productions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finished_productions_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;


-- Create a trigger function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    'gestor'::business_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also insert the missing profile for the current user
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', email),
  'gestor'::business_role
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;


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

-- Create storage bucket for technical sheet images
INSERT INTO storage.buckets (id, name, public)
VALUES ('technical-sheet-images', 'technical-sheet-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for finished production images
INSERT INTO storage.buckets (id, name, public)
VALUES ('finished-production-images', 'finished-production-images', true)
ON CONFLICT (id) DO NOTHING;

-- Add image_url column to finished_productions_stock if not exists
ALTER TABLE public.finished_productions_stock 
ADD COLUMN IF NOT EXISTS image_url text;

-- RLS policies for technical-sheet-images bucket
CREATE POLICY "Public can view technical sheet images"
ON storage.objects FOR SELECT
USING (bucket_id = 'technical-sheet-images');

CREATE POLICY "Authenticated users can upload technical sheet images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'technical-sheet-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update technical sheet images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'technical-sheet-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete technical sheet images"
ON storage.objects FOR DELETE
USING (bucket_id = 'technical-sheet-images' AND auth.role() = 'authenticated');

-- RLS policies for finished-production-images bucket
CREATE POLICY "Public can view finished production images"
ON storage.objects FOR SELECT
USING (bucket_id = 'finished-production-images');

CREATE POLICY "Authenticated users can upload finished production images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'finished-production-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update finished production images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'finished-production-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete finished production images"
ON storage.objects FOR DELETE
USING (bucket_id = 'finished-production-images' AND auth.role() = 'authenticated');

-- 1. Create enum for production type
CREATE TYPE public.production_type AS ENUM ('insumo', 'final');

-- 2. Add production_type to technical_sheets
ALTER TABLE public.technical_sheets 
ADD COLUMN production_type public.production_type NOT NULL DEFAULT 'final';

-- 3. Create technical_sheet_stages (etapas)
CREATE TABLE public.technical_sheet_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technical_sheet_id UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create technical_sheet_stage_steps (passos dentro das etapas)
CREATE TABLE public.technical_sheet_stage_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES public.technical_sheet_stages(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create produced_inputs_stock (estoque de insumos produzidos)
CREATE TABLE public.produced_inputs_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    technical_sheet_id UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE RESTRICT,
    batch_code TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'unidade',
    expiration_date DATE,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Create production_step_executions (registro de execuÃ§Ã£o dos passos)
CREATE TABLE public.production_step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES public.technical_sheet_stage_steps(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Add fields to productions for tracking consumed inputs
ALTER TABLE public.productions
ADD COLUMN consumed_produced_inputs JSONB DEFAULT '[]'::jsonb;

-- 8. Link technical_sheet_ingredients to stages (optional - ingredient can belong to a specific stage)
ALTER TABLE public.technical_sheet_ingredients
ADD COLUMN stage_id UUID REFERENCES public.technical_sheet_stages(id) ON DELETE SET NULL;

-- 9. Enable RLS on new tables
ALTER TABLE public.technical_sheet_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_sheet_stage_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produced_inputs_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_step_executions ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for technical_sheet_stages
CREATE POLICY "Users can view their own sheet stages"
ON public.technical_sheet_stages FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND can_access_owner_data(ts.user_id)
));

CREATE POLICY "Users can insert their own sheet stages"
ON public.technical_sheet_stages FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND ts.user_id = get_owner_id()
));

CREATE POLICY "Users can update their own sheet stages"
ON public.technical_sheet_stages FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND can_access_owner_data(ts.user_id)
));

CREATE POLICY "Users can delete their own sheet stages"
ON public.technical_sheet_stages FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.technical_sheets ts
    WHERE ts.id = technical_sheet_stages.technical_sheet_id
    AND can_access_owner_data(ts.user_id)
));

-- 11. RLS Policies for technical_sheet_stage_steps
CREATE POLICY "Users can view their own stage steps"
ON public.technical_sheet_stage_steps FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.technical_sheet_stages stg
    JOIN public.technical_sheets ts ON ts.id = stg.technical_sheet_id
    WHERE stg.id = technical_sheet_stage_steps.stage_id
    AND can_access_owner_data(ts.user_id)
));

CREATE POLICY "Users can insert their own stage steps"
ON public.technical_sheet_stage_steps FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.technical_sheet_stages stg
    JOIN public.technical_sheets ts ON ts.id = stg.technical_sheet_id
    WHERE stg.id = technical_sheet_stage_steps.stage_id
    AND ts.user_id = get_owner_id()
));

CREATE POLICY "Users can update their own stage steps"
ON public.technical_sheet_stage_steps FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.technical_sheet_stages stg
    JOIN public.technical_sheets ts ON ts.id = stg.technical_sheet_id
    WHERE stg.id = technical_sheet_stage_steps.stage_id
    AND can_access_owner_data(ts.user_id)
));

CREATE POLICY "Users can delete their own stage steps"
ON public.technical_sheet_stage_steps FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.technical_sheet_stages stg
    JOIN public.technical_sheets ts ON ts.id = stg.technical_sheet_id
    WHERE stg.id = technical_sheet_stage_steps.stage_id
    AND can_access_owner_data(ts.user_id)
));

-- 12. RLS Policies for produced_inputs_stock
CREATE POLICY "Users can view accessible produced inputs"
ON public.produced_inputs_stock FOR SELECT
USING (can_access_owner_data(user_id));

CREATE POLICY "Users can insert produced inputs for their org"
ON public.produced_inputs_stock FOR INSERT
WITH CHECK (user_id = get_owner_id());

CREATE POLICY "Users can update accessible produced inputs"
ON public.produced_inputs_stock FOR UPDATE
USING (can_access_owner_data(user_id));

CREATE POLICY "Users can delete accessible produced inputs"
ON public.produced_inputs_stock FOR DELETE
USING (can_access_owner_data(user_id));

-- 13. RLS Policies for production_step_executions
CREATE POLICY "Users can view accessible step executions"
ON public.production_step_executions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_step_executions.production_id
    AND can_access_owner_data(p.user_id)
));

CREATE POLICY "Users can insert step executions for their productions"
ON public.production_step_executions FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_step_executions.production_id
    AND p.user_id = get_owner_id()
));

CREATE POLICY "Users can update accessible step executions"
ON public.production_step_executions FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_step_executions.production_id
    AND can_access_owner_data(p.user_id)
));

CREATE POLICY "Users can delete accessible step executions"
ON public.production_step_executions FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_step_executions.production_id
    AND can_access_owner_data(p.user_id)
));

-- 14. Trigger for updated_at on produced_inputs_stock
CREATE TRIGGER update_produced_inputs_stock_updated_at
BEFORE UPDATE ON public.produced_inputs_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Add index for better performance
CREATE INDEX idx_technical_sheet_stages_sheet ON public.technical_sheet_stages(technical_sheet_id);
CREATE INDEX idx_technical_sheet_stage_steps_stage ON public.technical_sheet_stage_steps(stage_id);
CREATE INDEX idx_produced_inputs_stock_user ON public.produced_inputs_stock(user_id);
CREATE INDEX idx_produced_inputs_stock_sheet ON public.produced_inputs_stock(technical_sheet_id);
CREATE INDEX idx_production_step_executions_production ON public.production_step_executions(production_id);

-- Remove the overly permissive public SELECT policy on collaborators
-- This policy allows unauthenticated users to see all active collaborators
-- The collaborator-login edge function uses service role so doesn't need this
DROP POLICY IF EXISTS "Anyone can view active collaborators for login" ON public.collaborators;

-- Distributed rate limiting for collaborator login (prevents in-memory bypass)

CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_rate_limits_locked_until_idx
  ON public.login_rate_limits (locked_until);

ALTER TABLE public.login_rate_limits ENABLE ROW LEVEL SECURITY;

-- No RLS policies on purpose (default deny). Only service_role should use this table.
REVOKE ALL ON TABLE public.login_rate_limits FROM PUBLIC;
GRANT ALL ON TABLE public.login_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_collaborator_login_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 900,
  p_lockout_seconds INTEGER DEFAULT 1800
)
RETURNS TABLE(allowed BOOLEAN, minutes_remaining INTEGER)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
  v_window INTERVAL := make_interval(secs => p_window_seconds);
  v_row public.login_rate_limits%ROWTYPE;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    allowed := FALSE;
    minutes_remaining := 1;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Ensure serialization per key (prevents racing increments)
  PERFORM pg_advisory_xact_lock(hashtext(p_key));

  INSERT INTO public.login_rate_limits(key)
  VALUES (p_key)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.login_rate_limits
  WHERE key = p_key
  FOR UPDATE;

  -- Still locked
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now_ts THEN
    allowed := FALSE;
    minutes_remaining := CEIL(EXTRACT(EPOCH FROM (v_row.locked_until - now_ts)) / 60.0)::INT;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Reset window if expired (or lock expired)
  IF v_row.window_started_at <= (now_ts - v_window)
     OR (v_row.locked_until IS NOT NULL AND v_row.locked_until <= now_ts) THEN
    UPDATE public.login_rate_limits
    SET attempt_count = 0,
        window_started_at = now_ts,
        locked_until = NULL,
        updated_at = now_ts
    WHERE key = p_key;
  END IF;

  allowed := TRUE;
  minutes_remaining := 0;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_collaborator_login_attempt(
  p_key TEXT,
  p_success BOOLEAN,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 900,
  p_lockout_seconds INTEGER DEFAULT 1800
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
  v_window INTERVAL := make_interval(secs => p_window_seconds);
  v_row public.login_rate_limits%ROWTYPE;
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_window_started TIMESTAMPTZ;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_key));

  -- On success, clear state
  IF p_success THEN
    DELETE FROM public.login_rate_limits WHERE key = p_key;
    RETURN;
  END IF;

  INSERT INTO public.login_rate_limits(key)
  VALUES (p_key)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.login_rate_limits
  WHERE key = p_key
  FOR UPDATE;

  v_attempts := COALESCE(v_row.attempt_count, 0);
  v_locked_until := v_row.locked_until;
  v_window_started := v_row.window_started_at;

  -- Reset if window expired or lock expired
  IF v_window_started <= (now_ts - v_window)
     OR (v_locked_until IS NOT NULL AND v_locked_until <= now_ts) THEN
    v_attempts := 0;
    v_locked_until := NULL;
    v_window_started := now_ts;
  END IF;

  v_attempts := v_attempts + 1;

  IF v_attempts >= p_max_attempts THEN
    v_locked_until := now_ts + make_interval(secs => p_lockout_seconds);
  END IF;

  UPDATE public.login_rate_limits
  SET attempt_count = v_attempts,
      window_started_at = v_window_started,
      locked_until = v_locked_until,
      updated_at = now_ts
  WHERE key = p_key;
END;
$$;

-- Lock down RPCs so only service_role can call them
REVOKE EXECUTE ON FUNCTION public.check_collaborator_login_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_collaborator_login_attempt(TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_collaborator_login_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_collaborator_login_attempt(TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER) TO service_role;



-- Trigger to auto-assign admin role to the master admin email on profile creation
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'santiagomathiasen@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_assign_admin
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_admin_role();



-- Update admin email in the auto-assign trigger
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email = 'santiago.aloom@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;


-- Create enum for praÃ§as
CREATE TYPE public.production_praca AS ENUM ('gelateria', 'confeitaria', 'padaria', 'praca_quente', 'bar');

-- Add praca column to productions
ALTER TABLE public.productions ADD COLUMN praca public.production_praca NULL;

-- Create index for filtering by praÃ§a
CREATE INDEX idx_productions_praca ON public.productions(praca);

-- Add praca column to finished_productions_stock
ALTER TABLE public.finished_productions_stock 
ADD COLUMN praca text DEFAULT NULL;


-- Add 'paused' to production_status enum
ALTER TYPE "public"."production_status" ADD VALUE 'paused';


-- Final touch: Ensure 'paused' status exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'production_status' AND n.nspname = 'public') THEN
        ALTER TYPE public.production_status ADD VALUE IF NOT EXISTS 'paused';
    END IF;
END
$$;
