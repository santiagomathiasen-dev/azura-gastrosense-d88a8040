
-- Verificar se existem logs na tabela (últimos 10)
SELECT * FROM public.webhook_logs ORDER BY created_at DESC LIMIT 10;
