
DO $$
DECLARE
    v_carlos_company_id uuid := 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
    v_kayky_company_id uuid := '76c36f15-7759-467d-9b74-5424b5fdd00e';
BEGIN
    -- 1. Reverter Produtos
    UPDATE products 
    SET company_id = v_carlos_company_id 
    WHERE company_id = v_kayky_company_id;
    
    RAISE NOTICE 'Produtos movidos de volta para Carlos.';

    -- 2. Reverter Fornecedores
    UPDATE suppliers 
    SET company_id = v_carlos_company_id 
    WHERE company_id = v_kayky_company_id;
    
    RAISE NOTICE 'Fornecedores movidos de volta para Carlos.';

    -- 3. Reverter Movimentações
    UPDATE stock_movements 
    SET company_id = v_carlos_company_id 
    WHERE company_id = v_kayky_company_id;
    
    RAISE NOTICE 'Movimentações movidas de volta para Carlos.';

    -- 4. Reverter Setores
    UPDATE sectors 
    SET company_id = v_carlos_company_id 
    WHERE company_id = v_kayky_company_id;
    
    RAISE NOTICE 'Setores movidos de volta para Carlos.';

    -- 5. Reverter Categorias
    UPDATE categories 
    SET company_id = v_carlos_company_id 
    WHERE company_id = v_kayky_company_id;
    
    RAISE NOTICE 'Categorias movidas de volta para Carlos.';

    -- 6. Reverter Locais
    UPDATE locations 
    SET company_id = v_carlos_company_id 
    WHERE company_id = v_kayky_company_id;
    
    RAISE NOTICE 'Locais movidos de volta para Carlos.';

END $$;
