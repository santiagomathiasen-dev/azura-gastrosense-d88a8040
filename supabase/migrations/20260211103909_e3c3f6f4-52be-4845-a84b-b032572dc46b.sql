-- Add praca column to finished_productions_stock
ALTER TABLE public.finished_productions_stock 
ADD COLUMN praca text DEFAULT NULL;
