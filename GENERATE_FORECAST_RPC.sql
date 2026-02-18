
CREATE OR REPLACE FUNCTION generate_sales_forecast(
    target_date DATE,
    base_date DATE,
    buffer_percent DECIMAL DEFAULT 10
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid(); -- Get current user ID

    -- Delete existing forecasts for this target date to avoid duplicates/conflicts
    DELETE FROM sales_forecasts 
    WHERE user_id = v_user_id 
    AND target_date = generate_sales_forecast.target_date;

    -- Insert new forecasts based on historical sales + losses
    INSERT INTO sales_forecasts (user_id, sale_product_id, target_date, forecasted_quantity, notes)
    SELECT 
        v_user_id,
        sale_product_id,
        generate_sales_forecast.target_date,
        CEIL(SUM(total_quantity) * (1 + (buffer_percent / 100.0))), -- Apply buffer and round up
        'Gerado automaticamente com base em ' || to_char(base_date, 'DD/MM/YYYY')
    FROM (
        -- 1. Gather Sales
        SELECT sale_product_id, quantity_sold as total_quantity
        FROM sales
        WHERE user_id = v_user_id 
        AND sale_date = base_date

        UNION ALL

        -- 2. Gather Losses (for sale products only)
        -- Note: losses table has source_id. We need to join to check if it's a sale_product or rely on source_type
        SELECT source_id as sale_product_id, quantity as total_quantity
        FROM losses
        WHERE user_id = v_user_id 
        AND created_at::DATE = base_date -- Assuming losses are logged same day
        AND source_type = 'sale_product'
    ) as combined_data
    GROUP BY sale_product_id;

END;
$$;
