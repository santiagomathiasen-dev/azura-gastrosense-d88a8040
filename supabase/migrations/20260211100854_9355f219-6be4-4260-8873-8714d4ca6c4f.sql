-- Create enum for praças
CREATE TYPE public.production_praca AS ENUM ('gelateria', 'confeitaria', 'padaria', 'praca_quente', 'bar');

-- Add praca column to productions
ALTER TABLE public.productions ADD COLUMN praca public.production_praca NULL;

-- Create index for filtering by praça
CREATE INDEX idx_productions_praca ON public.productions(praca);