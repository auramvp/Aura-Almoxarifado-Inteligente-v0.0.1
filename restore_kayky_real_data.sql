
DO $$
DECLARE
    v_carlos_company_id uuid := 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
    v_kayky_company_id uuid := '76c36f15-7759-467d-9b74-5424b5fdd00e';
    v_cutoff_date timestamp with time zone := '2026-01-30 23:30:34.462377+00';
BEGIN
    -- 1. Restaurar Produtos Recentes (Pó de café, etc)
    UPDATE products 
    SET company_id = v_kayky_company_id 
    WHERE company_id = v_carlos_company_id 
    AND created_at >= v_cutoff_date;
    
    RAISE NOTICE 'Produtos recentes movidos para NIC. BR.';

    -- 2. Restaurar Movimentações Recentes
    UPDATE stock_movements 
    SET company_id = v_kayky_company_id 
    WHERE company_id = v_carlos_company_id 
    AND created_at >= v_cutoff_date;
    
    RAISE NOTICE 'Movimentações recentes movidas para NIC. BR.';

    -- 3. Restaurar Fornecedores Recentes (se houver)
    UPDATE suppliers 
    SET company_id = v_kayky_company_id 
    WHERE company_id = v_carlos_company_id 
    AND created_at >= v_cutoff_date;

    -- 4. Restaurar Setores Recentes
    UPDATE sectors 
    SET company_id = v_kayky_company_id 
    WHERE company_id = v_carlos_company_id 
    AND created_at >= v_cutoff_date;

    RAISE NOTICE 'Restauração concluída.';
END $$;
