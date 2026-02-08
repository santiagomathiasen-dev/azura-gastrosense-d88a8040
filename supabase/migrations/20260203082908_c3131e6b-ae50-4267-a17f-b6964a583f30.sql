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