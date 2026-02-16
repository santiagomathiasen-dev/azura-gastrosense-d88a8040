        -- Adiciona a coluna minimum_stock à tabela sale_products
        ALTER TABLE public.sale_products 
        ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC DEFAULT 0;

        -- Comentário para documentar a coluna
        COMMENT ON COLUMN public.sale_products.minimum_stock IS 'Nível mínimo de estoque pronto para venda antes de gerar alerta';

        -- Garante que o valor padrão seja 0 para registros existentes
        UPDATE public.sale_products SET minimum_stock = 0 WHERE minimum_stock IS NULL;
