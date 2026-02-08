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

-- 6. Create production_step_executions (registro de execução dos passos)
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