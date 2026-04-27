INSERT INTO sale_products (name, is_active, ready_quantity, user_id)
SELECT 'Produto Teste', true, 10, id FROM auth.users LIMIT 1;
