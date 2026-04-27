
SELECT count(*) as total_logs FROM webhook_logs;
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 5;
