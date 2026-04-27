
-- Script to seed data for POS Integration Testing

-- 1. Ensure at least one profile has 'gestor' role (required for sale attribution)
-- This updates the first found profile to 'gestor' if no gestor exists.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'gestor') THEN
        UPDATE public.profiles
        SET role = 'gestor'
        WHERE id = (SELECT id FROM public.profiles LIMIT 1);
    END IF;
END $$;

-- 2. Insert 'Produto Fantasma' for testing
-- Finds a gestor user to assign the product to.
INSERT INTO public.sale_products (name, description, is_active, sale_price, user_id, ready_quantity)
SELECT 
    'Produto Fantasma', 
    'Produto para teste de integração via Webhook', 
    true, 
    10.00, 
    id, 
    100
FROM public.profiles 
WHERE role = 'gestor' 
AND NOT EXISTS (SELECT 1 FROM public.sale_products WHERE name = 'Produto Fantasma')
LIMIT 1;

-- 3. Output verification (for the user running this in SQL Editor)
SELECT count(*) as gestors_count FROM public.profiles WHERE role = 'gestor';
SELECT name, is_active FROM public.sale_products WHERE name = 'Produto Fantasma';
