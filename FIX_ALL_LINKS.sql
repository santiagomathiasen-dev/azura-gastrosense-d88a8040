
DO $$
DECLARE
    v_stock_id UUID;
    r RECORD;
BEGIN
    -- 1. Pegar o ID do Estoque 'Croissant (Estoque)'
    SELECT id INTO v_stock_id FROM stock_items WHERE name = 'Croissant (Estoque)' LIMIT 1;
    
    IF v_stock_id IS NULL THEN
        RAISE NOTICE '❌ ERRO: Item de Estoque Croissant (Estoque) não encontrado!';
        RETURN;
    END IF;

    -- 2. Percorrer TODOS os produtos de venda que tenham "Croissant" no nome
    -- Isso garante que se tiver duplicado, TODOS ficam corrigidos.
    FOR r IN SELECT id, name FROM sale_products WHERE name ILIKE '%Croissant%'
    LOOP
        RAISE NOTICE '🔧 Consertando link para o produto: % (ID: %)', r.name, r.id;
        
        -- Remove link antigo (se houver) para não dar erro
        DELETE FROM sale_product_components WHERE sale_product_id = r.id;
        
        -- Cria o link novo
        INSERT INTO sale_product_components (sale_product_id, component_type, component_id, quantity, unit)
        VALUES (r.id, 'stock_item', v_stock_id, 1, 'unidade');
        
    END LOOP;
    
    RAISE NOTICE '✅ SUCESSO! Todos os Croissants foram vinculados ao estoque.';
END $$;
