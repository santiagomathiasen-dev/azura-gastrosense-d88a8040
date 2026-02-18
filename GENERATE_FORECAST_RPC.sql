
CREATE OR REPLACE FUNCTION generate_sales_forecast(
    target_date DATE,
    base_date DATE,
    buffer_percent DECIMAL DEFAULT 10,
    period_type TEXT DEFAULT 'day'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_start_date DATE;
    v_num_days INT;
BEGIN
    v_user_id := auth.uid();

    -- Calculate date range based on period_type
    CASE period_type
        WHEN 'day' THEN
            v_start_date := base_date;
            v_num_days := 1;
        WHEN 'week' THEN
            v_start_date := base_date - INTERVAL '6 days';
            v_num_days := 7;
        WHEN 'month' THEN
            v_start_date := base_date - INTERVAL '29 days';
            v_num_days := 30;
        WHEN 'year' THEN
            v_start_date := base_date - INTERVAL '364 days';
            v_num_days := 365;
        ELSE
            v_start_date := base_date;
            v_num_days := 1;
    END CASE;

    -- Delete existing forecasts for this target date to avoid duplicates
    DELETE FROM sales_forecasts 
    WHERE user_id = v_user_id 
    AND target_date = generate_sales_forecast.target_date;

    -- Insert new forecasts based on historical sales + losses (daily average)
    INSERT INTO sales_forecasts (user_id, sale_product_id, target_date, forecasted_quantity, notes)
    SELECT 
        v_user_id,
        sale_product_id,
        generate_sales_forecast.target_date,
        CEIL((SUM(total_quantity)::DECIMAL / v_num_days) * (1 + (buffer_percent / 100.0))),
        CASE period_type
            WHEN 'day' THEN 'Baseado em ' || to_char(base_date, 'DD/MM/YYYY')
            WHEN 'week' THEN 'Média semanal (' || to_char(v_start_date::DATE, 'DD/MM') || ' a ' || to_char(base_date, 'DD/MM/YYYY') || ')'
            WHEN 'month' THEN 'Média mensal (' || to_char(v_start_date::DATE, 'DD/MM') || ' a ' || to_char(base_date, 'DD/MM/YYYY') || ')'
            WHEN 'year' THEN 'Média anual (' || to_char(v_start_date::DATE, 'DD/MM/YYYY') || ' a ' || to_char(base_date, 'DD/MM/YYYY') || ')'
            ELSE 'Gerado automaticamente'
        END
    FROM (
        -- 1. Gather Sales in date range
        SELECT sale_product_id, quantity_sold as total_quantity
        FROM sales
        WHERE user_id = v_user_id 
        AND sale_date >= v_start_date
        AND sale_date <= base_date

        UNION ALL

        -- 2. Gather Losses (for sale products only) in date range
        SELECT source_id as sale_product_id, quantity as total_quantity
        FROM losses
        WHERE user_id = v_user_id 
        AND created_at::DATE >= v_start_date
        AND created_at::DATE <= base_date
        AND source_type = 'sale_product'
    ) as combined_data
    GROUP BY sale_product_id;

END;
$$;
