
-- Verificar se o vinculo existe
SELECT 
    sp.name as produto_venda,
    si.name as item_estoque,
    spc.quantity as qtd_baixa,
    si.current_quantity as estoque_atual
FROM sale_products sp
LEFT JOIN sale_product_components spc ON sp.id = spc.sale_product_id
LEFT JOIN stock_items si ON spc.component_id = si.id
WHERE sp.name ILIKE '%Croissant%';
