-- Add 'requested' to production_status enum
-- Since PostgreSQL doesn't allow adding values to enums inside a transaction in some versions, 
-- or requires specific handling, we'll use a safe way to add it if it doesn't exist.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'requested' AND enumtypid = 'public.production_status'::regtype) THEN
        ALTER TYPE public.production_status ADD VALUE 'requested' BEFORE 'planned';
    END IF;
END
$$;

-- Create production_stage_executions table
CREATE TABLE IF NOT EXISTS public.production_stage_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.technical_sheet_stages(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(production_id, stage_id)
);

-- Enable RLS
ALTER TABLE public.production_stage_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own stage executions"
ON public.production_stage_executions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_stage_executions.production_id
    AND can_access_owner_data(p.user_id)
));

CREATE POLICY "Users can insert their own stage executions"
ON public.production_stage_executions FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_stage_executions.production_id
    AND p.user_id = get_owner_id()
));

CREATE POLICY "Users can update their own stage executions"
ON public.production_stage_executions FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_stage_executions.production_id
    AND can_access_owner_data(p.user_id)
));

CREATE POLICY "Users can delete their own stage executions"
ON public.production_stage_executions FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.productions p
    WHERE p.id = production_stage_executions.production_id
    AND can_access_owner_data(p.user_id)
));

-- Trigger for updated_at
CREATE TRIGGER update_production_stage_executions_updated_at
BEFORE UPDATE ON public.production_stage_executions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
