
-- Check if the user exists in auth.users
SELECT id, email, created_at FROM auth.users WHERE email = 'santiago.aloom@gmail.com';

-- Check if the user exists in public.profiles
SELECT * FROM public.profiles WHERE email = 'santiago.aloom@gmail.com';

-- Check all gestors
SELECT * FROM public.profiles WHERE role = 'gestor';
