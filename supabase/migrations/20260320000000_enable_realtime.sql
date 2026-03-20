-- Enable Supabase Realtime for all core tables
-- This ensures that any change (INSERT, UPDATE, DELETE) in these tables
-- is broadcast to subscribed frontend clients in real time.

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_products;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE productions;
ALTER PUBLICATION supabase_realtime ADD TABLE finished_productions_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE production_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE technical_sheets;
ALTER PUBLICATION supabase_realtime ADD TABLE technical_sheet_ingredients;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_product_components;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
