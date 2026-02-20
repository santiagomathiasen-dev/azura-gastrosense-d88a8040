CREATE OR REPLACE FUNCTION generate_sales_forecast(target_date DATE, base_date DATE, buffer_percent DECIMAL DEFAULT 10, period_type TEXT DEFAULT 'day') RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_user_id UUID;
  v_start_date DATE;
  v_num_days INT;
BEGIN
  v_user_id := auth.uid();
  CASE period_type
    WHEN 'day' THEN v_start_date := base_date; v_num_days := 1;
    WHEN 'week' THEN v_start_date := base_date - 6; v_num_days := 7;
    WHEN 'month' THEN v_start_date := base_date - 29; v_num_days := 30;
    WHEN 'year' THEN v_start_date := base_date - 364; v_num_days := 365;
    ELSE v_start_date := base_date; v_num_days := 1;
  END CASE;

  DELETE FROM sales_forecasts WHERE user_id = v_user_id AND sales_forecasts.target_date = generate_sales_forecast.target_date;

  INSERT INTO sales_forecasts (user_id, sale_product_id, target_date, forecasted_quantity, notes)
  SELECT
    v_user_id,
    sale_product_id,
    generate_sales_forecast.target_date,
    CEIL(SUM(total_quantity)::DECIMAL * (1 + (buffer_percent / 100.0))),
    CASE period_type
      WHEN 'day' THEN 'Vendas e perdas do dia ' || to_char(base_date, 'DD/MM/YYYY')
      WHEN 'week' THEN 'Consumo total - Últimos 7 dias (' || to_char(v_start_date, 'DD/MM') || ' a ' || to_char(base_date, 'DD/MM/YYYY') || ')'
      WHEN 'month' THEN 'Consumo total - Últimos 30 dias (' || to_char(v_start_date, 'DD/MM') || ' a ' || to_char(base_date, 'DD/MM/YYYY') || ')'
      WHEN 'year' THEN 'Consumo total - Último ano (' || to_char(v_start_date, 'DD/MM/YYYY') || ' a ' || to_char(base_date, 'DD/MM/YYYY') || ')'
      ELSE 'Gerado automaticamente'
    END
  FROM (
    SELECT sale_product_id, quantity_sold as total_quantity FROM sales WHERE user_id = v_user_id AND sale_date >= v_start_date AND sale_date <= base_date
    UNION ALL
    SELECT source_id as sale_product_id, quantity as total_quantity FROM losses WHERE user_id = v_user_id AND created_at::DATE >= v_start_date AND created_at::DATE <= base_date AND source_type = 'sale_product'
  ) as combined_data
  GROUP BY sale_product_id;
END;
$func$;
