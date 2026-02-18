
-- 1. Ver se existem produtos duplicados
SELECT 'PRODUTOS ENCONTRADOS:' as info;
SELECT id, name, is_active, created_at 
FROM sale_products 
WHERE name ILIKE '%Croissant%';

-- 2. Ver a ultima venda registrada e qual ID ela usou
SELECT 'ULTIMA VENDA:' as info;
SELECT s.id as venda_id, s.sale_product_id, p.name as nome_produto_usado, s.created_at
FROM sales s
LEFT JOIN sale_products p ON s.sale_product_id = p.id
ORDER BY s.created_at DESC
LIMIT 1;

-- 3. Ver componentes do produto usado na ultima venda
SELECT 'COMPONENTES DO PRODUTO DA VENDA:' as info;
SELECT spc.*, si.name as nome_estoque
FROM sale_product_components spc
LEFT JOIN stock_items si ON spc.component_id = si.id
WHERE spc.sale_product_id = (SELECT sale_product_id FROM sales ORDER BY created_at DESC LIMIT 1);
