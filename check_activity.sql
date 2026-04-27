
-- Check recent sales
SELECT * FROM sales ORDER BY created_at DESC LIMIT 5;

-- Check recent stock movements
SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 5;
