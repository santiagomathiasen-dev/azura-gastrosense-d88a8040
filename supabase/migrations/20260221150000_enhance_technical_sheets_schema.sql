-- Migration to enhance technical_sheets table with financial and sectorization fields

ALTER TABLE public.technical_sheets ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0;
ALTER TABLE public.technical_sheets ADD COLUMN IF NOT EXISTS energy_cost NUMERIC DEFAULT 0;
ALTER TABLE public.technical_sheets ADD COLUMN IF NOT EXISTS other_costs NUMERIC DEFAULT 0;
ALTER TABLE public.technical_sheets ADD COLUMN IF NOT EXISTS markup NUMERIC DEFAULT 0;
ALTER TABLE public.technical_sheets ADD COLUMN IF NOT EXISTS target_price NUMERIC;
ALTER TABLE public.technical_sheets ADD COLUMN IF NOT EXISTS praca TEXT;

-- Update RLS if needed (usually columns inherit table-level RLS, but double-checking is good)
-- Policies for technical_sheets are already based on user_id, which applies to new columns.

COMMENT ON COLUMN public.technical_sheets.labor_cost IS 'Custo de mão de obra estimado para a ficha técnica';
COMMENT ON COLUMN public.technical_sheets.energy_cost IS 'Custo de energia/gás estimado para a ficha técnica';
COMMENT ON COLUMN public.technical_sheets.other_costs IS 'Outros custos variáveis estimados';
COMMENT ON COLUMN public.technical_sheets.markup IS 'Markup desejado para cálculo de preço sugerido';
COMMENT ON COLUMN public.technical_sheets.target_price IS 'Preço de venda alvo para a ficha técnica';
COMMENT ON COLUMN public.technical_sheets.praca IS 'Setor ou praça responsável pela produção (ex: Cozinha Quente, Confeitaria)';
