-- Add unit_price column to stock_items table for ingredient pricing
ALTER TABLE public.stock_items 
ADD COLUMN unit_price numeric DEFAULT 0;