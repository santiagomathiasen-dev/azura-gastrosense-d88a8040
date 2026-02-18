
SELECT 
    t.relname as table_name,
    c.column_name,
    c.data_type
FROM 
    information_schema.columns c
JOIN 
    pg_class t ON c.table_name = t.relname
WHERE 
    t.relname IN ('sale_product_components', 'stock_items', 'technical_sheets')
ORDER BY 
    table_name, column_name;
