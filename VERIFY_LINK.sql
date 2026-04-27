
-- Verify Linkage
SELECT 
    sp.name as sale_product,
    spc.component_type,
    spc.quantity as deduction_qty,
    si.name as stock_item_name,
    si.current_quantity as current_stock
FROM sale_products sp
LEFT JOIN sale_product_components spc ON sp.id = spc.sale_product_id
LEFT JOIN stock_items si ON spc.component_id = si.id
WHERE sp.name ILIKE 'Croissant';
