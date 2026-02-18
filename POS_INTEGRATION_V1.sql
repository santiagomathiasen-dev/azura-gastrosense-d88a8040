-- Create API Keys table for POS authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  description TEXT,
  key_hash TEXT NOT NULL, 
  key_value TEXT NOT NULL UNIQUE, 
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own API keys
-- DROP POLICY IF EXISTS to avoid errors on re-run
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;

CREATE POLICY "Users can view their own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Function to handle POS Sale (Transaction)
DROP FUNCTION IF EXISTS process_pos_sale(UUID, JSONB);

CREATE OR REPLACE FUNCTION process_pos_sale(
  p_user_id UUID,
  p_sale_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass RLS for system operations if needed, or ensuring access
AS $$
DECLARE
  v_item JSONB;
  v_sale_product_id UUID;
  v_quantity NUMERIC;
  v_sale_date DATE;
  v_component RECORD;
  v_stock_item_id UUID;
  v_deduct_qty NUMERIC;
BEGIN
  -- 1. Parse Date
  v_sale_date := (p_sale_payload->>'date_time')::DATE;

  -- 2. Iterate Sold Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sale_payload->'sold_items')
  LOOP
    v_sale_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    -- A. Insert into Sales History
    INSERT INTO sales (
      user_id,
      sale_product_id,
      quantity_sold,
      sale_date,
      notes
    ) VALUES (
      p_user_id,
      v_sale_product_id,
      v_quantity,
      v_sale_date,
      'Integração PDV - ' || (p_sale_payload->>'payment_method')
    );

    -- B. Deduct Stock (Explosion)
    -- Loop through components of the sale product
    FOR v_component IN 
      SELECT * FROM sale_product_components 
      WHERE sale_product_id = v_sale_product_id
    LOOP
      
      -- Case 1: Simple Stock Item (Direct Resale or Raw Material)
      IF v_component.component_type = 'stock_item' THEN
        v_stock_item_id := v_component.component_id;
        v_deduct_qty := v_component.quantity * v_quantity;

        -- Update Stock (Allow negative)
        UPDATE stock_items
        SET current_quantity = current_quantity - v_deduct_qty,
            updated_at = NOW()
        WHERE id = v_stock_item_id;

        -- Log Movement
        INSERT INTO stock_movements (
          user_id,
          stock_item_id,
          type,
          quantity,
          source,
          notes
        ) VALUES (
          p_user_id,
          v_stock_item_id,
          'exit',
          v_deduct_qty,
          'manual', 
          'Venda PDV'
        );

      -- Case 2: Finished Production (e.g. A cake slice from a Cake)
      ELSIF v_component.component_type = 'finished_production' THEN
        
        UPDATE finished_productions_stock
        SET quantity = quantity - (v_component.quantity * v_quantity)
        WHERE technical_sheet_id = v_component.component_id;
        
      END IF;

    END LOOP;

  END LOOP;

  RETURN jsonb_build_object('success', true, 'message', 'Vendas processadas com sucesso');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
