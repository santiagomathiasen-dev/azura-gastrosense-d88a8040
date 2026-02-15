-- Standalone script to add 'paused' status to existing production_status enum
-- This is useful if the database has already been initialized

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'production_status' 
        AND e.enumlabel = 'paused'
    ) THEN
        ALTER TYPE public.production_status ADD VALUE 'paused';
    END IF;
END $$;
