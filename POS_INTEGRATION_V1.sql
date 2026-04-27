-- Updated process_pos_sale with $func$ delimiter and ready_quantity deduction
DROP FUNCTION IF EXISTS process_pos_sale(UUID, JSONB);

CREATE OR REPLACE FUNCTION process_pos_sale(p_user_id UUID, p_sale_payload JSONB) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_item JSONB;
  v_sale_product_id UUID;
  v_quantity NUMERIC;
  v_sale_date DATE;
  v_component RECORD;
  v_stock_item_id UUID;
  v_deduct_qty NUMERIC;
BEGIN
  v_sale_date := (p_sale_payload->>'date_time')::DATE;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sale_payload->'sold_items')
  LOOP
    v_sale_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    -- A. Insert into Sales History
    INSERT INTO sales (user_id, sale_product_id, quantity_sold, sale_date, notes)
    VALUES (p_user_id, v_sale_product_id, v_quantity, v_sale_date, 'Integracao PDV - ' || (p_sale_payload->>'payment_method'));

    -- B. Deduct ready_quantity from sale_products
    UPDATE sale_products
    SET ready_quantity = GREATEST(0, COALESCE(ready_quantity, 0) - v_quantity)
    WHERE id = v_sale_product_id;

    -- C. Deduct Stock (Explosion) from components
    FOR v_component IN
      SELECT * FROM sale_product_components
      WHERE sale_product_id = v_sale_product_id
    LOOP
      IF v_component.component_type = 'stock_item' THEN
        v_stock_item_id := v_component.component_id;
        v_deduct_qty := v_component.quantity * v_quantity;

        UPDATE stock_items
        SET current_quantity = current_quantity - v_deduct_qty, updated_at = NOW()
        WHERE id = v_stock_item_id;

        INSERT INTO stock_movements (user_id, stock_item_id, type, quantity, source, notes)
        VALUES (p_user_id, v_stock_item_id, 'exit', v_deduct_qty, 'sale', 'Venda PDV');

      ELSIF v_component.component_type = 'finished_production' THEN
        UPDATE finished_productions_stock
        SET quantity = GREATEST(0, quantity - (v_component.quantity * v_quantity))
        WHERE technical_sheet_id = v_component.component_id;
      END IF;
    END LOOP;

  END LOOP;

  RETURN jsonb_build_object('success', true, 'message', 'Vendas processadas com sucesso');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$func$;
