-- ========================================
-- PRE-REQUISITOS: ENUMS, TABELAS E FUNCOES
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
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  gestor_id UUID REFERENCES public.profiles(id),
  role public.business_role NOT NULL DEFAULT 'gestor',
  status_pagamento BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: get_owner_id
CREATE OR REPLACE FUNCTION public.get_owner_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gestor_id uuid;
BEGIN
    SELECT gestor_id INTO v_gestor_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_gestor_id, auth.uid());
END;
$$;

-- Helper function: can_access_owner_data
CREATE OR REPLACE FUNCTION public.can_access_owner_data(data_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN get_owner_id() = data_owner_id;
END;
$$;

-- Helper function: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS business_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role business_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN v_role;
END;
$$;

-- Basic RLS policies for profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own profile' AND polrelid = 'public.profiles'::regclass) THEN
        CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own profile' AND polrelid = 'public.profiles'::regclass) THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
END
$$;
