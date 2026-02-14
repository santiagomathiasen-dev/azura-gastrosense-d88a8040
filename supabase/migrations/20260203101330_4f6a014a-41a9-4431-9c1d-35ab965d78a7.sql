-- Add auth_user_id column to link collaborators to Supabase Auth users
ALTER TABLE public.collaborators
ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add unique constraint to prevent multiple collaborators linking to same auth user
ALTER TABLE public.collaborators
ADD CONSTRAINT collaborators_auth_user_id_key UNIQUE (auth_user_id);