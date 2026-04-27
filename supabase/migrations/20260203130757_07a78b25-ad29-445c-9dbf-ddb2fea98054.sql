-- Enable realtime for all main data tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.technical_sheets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.productions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finished_productions_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;