-- Adicionar coluna de estoque mÃ­nimo nas fichas tÃ©cnicas
ALTER TABLE public.technical_sheets 
ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC DEFAULT 0;

-- ComentÃ¡rio explicativo
COMMENT ON COLUMN public.technical_sheets.minimum_stock IS 'NÃ­vel mÃ­nimo de estoque para produÃ§Ãµes finalizadas desta ficha';
