-- ========================================
-- PRE-REQUISITOS: ENUMS E TABELAS BASE
-- ========================================

-- Create business_role enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'business_role' AND n.nspname = 'public') THEN
        CREATE TYPE public.business_role AS ENUM ('gestor', 'producao', 'estoque', 'venda', 'teste');
    END IF;
END
$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
