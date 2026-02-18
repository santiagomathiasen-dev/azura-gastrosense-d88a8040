
-- Check if 'Croissant' exists and has components
WITH product AS (
    SELECT id, name FROM sale_products WHERE name ILIKE 'Croissant' LIMIT 1
)
SELECT 
    p.name as product_name, 
    c.component_type, 
    c.component_id, 
    c.quantity 
FROM product p
LEFT JOIN sale_product_components c ON p.id = c.sale_product_id;

-- Also check if there are any stock items or finished productions with similar name
SELECT id, name, 'stock_item' as type FROM stock_items WHERE name ILIKE '%Croissant%'
UNION ALL
SELECT id, name, 'finished_production' as type FROM finished_productions_stock WHERE name ILIKE '%Croissant%';
