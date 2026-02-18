
-- Tabela para logs do Webhook (Debug)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    payload JSONB,
    status TEXT, -- 'success', 'error', 'received'
    error_message TEXT
);

-- Habilitar RLS (opcional, mas boa prática)
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Permitir que a Service Role (usada pela Edge Function) insira dados
CREATE POLICY "Service Role can insert logs" 
ON public.webhook_logs 
FOR INSERT 
TO service_role 
WITH CHECK (true);

-- Permitir que a Service Role leia dados (para debug se necessário)
CREATE POLICY "Service Role can read logs" 
ON public.webhook_logs 
FOR SELECT 
TO service_role 
USING (true);

-- Permitir que usuários autenticados (como você no dashboard) leiam os logs
CREATE POLICY "Users can read logs" 
ON public.webhook_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);
