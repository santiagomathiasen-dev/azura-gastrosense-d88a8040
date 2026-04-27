
-- Force Link Creation (Delete old, Insert new)
DO $$
DECLARE
    v_sale_id UUID;
    v_stock_id UUID;
BEGIN
    -- 1. Find IDs
    SELECT id INTO v_sale_id FROM sale_products WHERE name ILIKE 'Croissant' LIMIT 1;
    SELECT id INTO v_stock_id FROM stock_items WHERE name = 'Croissant (Estoque)' LIMIT 1;

    -- 2. Validate
    IF v_sale_id IS NULL THEN
        RAISE NOTICE 'Sale Product Croissant NOT FOUND';
    END IF;
    IF v_stock_id IS NULL THEN
        RAISE NOTICE 'Stock Item Croissant (Estoque) NOT FOUND';
    END IF;

    IF v_sale_id IS NOT NULL AND v_stock_id IS NOT NULL THEN
        -- 3. Cleanup existing
        DELETE FROM sale_product_components WHERE sale_product_id = v_sale_id;
        
        -- 4. Insert new link
        INSERT INTO sale_product_components (sale_product_id, component_type, component_id, quantity, unit)
        VALUES (v_sale_id, 'stock_item', v_stock_id, 1, 'unidade');
        
        RAISE NOTICE 'Link Created Successfully!';
    END IF;
END $$;

-- 5. Show Result
SELECT 
    sp.name as sale_product,
    spc.component_type,
    spc.quantity,
    spc.unit,
    si.name as stock_item
FROM sale_products sp
JOIN sale_product_components spc ON sp.id = spc.sale_product_id
JOIN stock_items si ON spc.component_id = si.id
WHERE sp.name ILIKE 'Croissant';
