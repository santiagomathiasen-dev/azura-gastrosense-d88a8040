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

-- Enum para tipo de movimentação
CREATE TYPE public.movement_type AS ENUM (
  'entry',
  'exit',
  'adjustment'
);

-- Enum para origem da movimentação
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

-- Tabela de movimentações de estoque
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

-- Índices para performance
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

-- Função para atualizar quantidade de estoque após movimentação
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