
DO $$
DECLARE
  v_user_id UUID;
  v_stock_item_id UUID;
  v_sale_product_id UUID;
BEGIN
  -- 1. Get User
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'santiago.aloom@gmail.com' LIMIT 1;
  
  -- 2. Get or Create Stock Item
  SELECT id INTO v_stock_item_id FROM stock_items WHERE name = 'Croissant (Estoque)' LIMIT 1;
  
  IF v_stock_item_id IS NULL THEN
    INSERT INTO stock_items (user_id, name, unit, current_quantity, minimum_quantity)
    VALUES (v_user_id, 'Croissant (Estoque)', 'unidade', 100, 10)
    RETURNING id INTO v_stock_item_id;
  END IF;

  -- 3. Get Sale Product
  SELECT id INTO v_sale_product_id FROM sale_products WHERE name ILIKE 'Croissant' LIMIT 1;

  -- 4. Link Component
  IF v_sale_product_id IS NOT NULL AND v_stock_item_id IS NOT NULL THEN
     IF NOT EXISTS (SELECT 1 FROM sale_product_components WHERE sale_product_id = v_sale_product_id AND component_id = v_stock_item_id) THEN
        INSERT INTO sale_product_components (sale_product_id, component_type, component_id, quantity, unit)
        VALUES (v_sale_product_id, 'stock_item', v_stock_item_id, 1, 'unidade');
     END IF;
  END IF;
END $$;
