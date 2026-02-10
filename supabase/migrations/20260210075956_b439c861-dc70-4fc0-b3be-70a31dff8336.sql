
-- Trigger to auto-assign admin role to the master admin email on profile creation
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'santiagomathiasen@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_assign_admin
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_admin_role();
