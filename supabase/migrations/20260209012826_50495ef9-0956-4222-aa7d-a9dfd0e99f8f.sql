-- Distributed rate limiting for collaborator login (prevents in-memory bypass)

CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_rate_limits_locked_until_idx
  ON public.login_rate_limits (locked_until);

ALTER TABLE public.login_rate_limits ENABLE ROW LEVEL SECURITY;

-- No RLS policies on purpose (default deny). Only service_role should use this table.
REVOKE ALL ON TABLE public.login_rate_limits FROM PUBLIC;
GRANT ALL ON TABLE public.login_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_collaborator_login_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 900,
  p_lockout_seconds INTEGER DEFAULT 1800
)
RETURNS TABLE(allowed BOOLEAN, minutes_remaining INTEGER)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
  v_window INTERVAL := make_interval(secs => p_window_seconds);
  v_row public.login_rate_limits%ROWTYPE;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    allowed := FALSE;
    minutes_remaining := 1;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Ensure serialization per key (prevents racing increments)
  PERFORM pg_advisory_xact_lock(hashtext(p_key));

  INSERT INTO public.login_rate_limits(key)
  VALUES (p_key)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.login_rate_limits
  WHERE key = p_key
  FOR UPDATE;

  -- Still locked
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now_ts THEN
    allowed := FALSE;
    minutes_remaining := CEIL(EXTRACT(EPOCH FROM (v_row.locked_until - now_ts)) / 60.0)::INT;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Reset window if expired (or lock expired)
  IF v_row.window_started_at <= (now_ts - v_window)
     OR (v_row.locked_until IS NOT NULL AND v_row.locked_until <= now_ts) THEN
    UPDATE public.login_rate_limits
    SET attempt_count = 0,
        window_started_at = now_ts,
        locked_until = NULL,
        updated_at = now_ts
    WHERE key = p_key;
  END IF;

  allowed := TRUE;
  minutes_remaining := 0;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_collaborator_login_attempt(
  p_key TEXT,
  p_success BOOLEAN,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 900,
  p_lockout_seconds INTEGER DEFAULT 1800
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
  v_window INTERVAL := make_interval(secs => p_window_seconds);
  v_row public.login_rate_limits%ROWTYPE;
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_window_started TIMESTAMPTZ;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_key));

  -- On success, clear state
  IF p_success THEN
    DELETE FROM public.login_rate_limits WHERE key = p_key;
    RETURN;
  END IF;

  INSERT INTO public.login_rate_limits(key)
  VALUES (p_key)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.login_rate_limits
  WHERE key = p_key
  FOR UPDATE;

  v_attempts := COALESCE(v_row.attempt_count, 0);
  v_locked_until := v_row.locked_until;
  v_window_started := v_row.window_started_at;

  -- Reset if window expired or lock expired
  IF v_window_started <= (now_ts - v_window)
     OR (v_locked_until IS NOT NULL AND v_locked_until <= now_ts) THEN
    v_attempts := 0;
    v_locked_until := NULL;
    v_window_started := now_ts;
  END IF;

  v_attempts := v_attempts + 1;

  IF v_attempts >= p_max_attempts THEN
    v_locked_until := now_ts + make_interval(secs => p_lockout_seconds);
  END IF;

  UPDATE public.login_rate_limits
  SET attempt_count = v_attempts,
      window_started_at = v_window_started,
      locked_until = v_locked_until,
      updated_at = now_ts
  WHERE key = p_key;
END;
$$;

-- Lock down RPCs so only service_role can call them
REVOKE EXECUTE ON FUNCTION public.check_collaborator_login_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_collaborator_login_attempt(TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_collaborator_login_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_collaborator_login_attempt(TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER) TO service_role;
