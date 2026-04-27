-- Fix SECURITY DEFINER function to validate ownership before updating stock quantities
-- This prevents users from manipulating stock items they don't own

CREATE OR REPLACE FUNCTION public.update_stock_quantity()
RETURNS TRIGGER AS $$
DECLARE
  item_user_id UUID;
BEGIN
  -- Verify stock_item exists and get its owner
  SELECT user_id INTO item_user_id 
  FROM public.stock_items 
  WHERE id = NEW.stock_item_id;
  
  IF item_user_id IS NULL THEN
    RAISE EXCEPTION 'Stock item not found';
  END IF;
  
  -- Verify the stock item belongs to the same user as the movement
  IF item_user_id != NEW.user_id THEN
    RAISE EXCEPTION 'Cannot update stock item owned by different user';
  END IF;
  
  -- Proceed with update only if ownership matches
  IF NEW.type = 'entry' THEN
    UPDATE public.stock_items
    SET current_quantity = current_quantity + NEW.quantity
    WHERE id = NEW.stock_item_id AND user_id = NEW.user_id;
  ELSIF NEW.type = 'exit' THEN
    UPDATE public.stock_items
    SET current_quantity = GREATEST(0, current_quantity - NEW.quantity)
    WHERE id = NEW.stock_item_id AND user_id = NEW.user_id;
  ELSIF NEW.type = 'adjustment' THEN
    UPDATE public.stock_items
    SET current_quantity = NEW.quantity
    WHERE id = NEW.stock_item_id AND user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;