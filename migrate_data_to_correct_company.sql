
-- Script para migrar produtos e dados relacionados para a empresa correta (NIC. BR)
-- Empresa Correta (NIC. BR / Joao / contato.auramvp): 76c36f15-7759-467d-9b74-5424b5fdd00e
-- Empresa Onde Estão os Produtos (Fantasma/Antiga): dce86f24-1154-43e8-8b27-1a9c6fe2ce8a

DO $$
DECLARE
    v_correct_company_id uuid := '76c36f15-7759-467d-9b74-5424b5fdd00e';
    v_wrong_company_id uuid := 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
BEGIN
    -- 1. Migrar Produtos
    UPDATE products 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;
    
    RAISE NOTICE 'Produtos migrados para a empresa %', v_correct_company_id;

    -- 2. Migrar Movimentações (Stock Movements)
    UPDATE stock_movements 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;
    
    RAISE NOTICE 'Movimentações migradas.';

    -- 3. Migrar Fornecedores
    UPDATE suppliers 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;
    
    RAISE NOTICE 'Fornecedores migrados.';

    -- 4. Migrar Setores
    UPDATE sectors 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;
    
    RAISE NOTICE 'Setores migrados.';

    -- 5. Migrar Categorias
    UPDATE categories 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;
    
    RAISE NOTICE 'Categorias migradas.';

    -- 6. Migrar Locais de Armazenamento
    UPDATE locations 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;
    
    RAISE NOTICE 'Locais migrados.';
    
    -- 7. Remover a empresa antiga (opcional, apenas se não tiver usuários restantes)
    -- Verificando se restou alguém lá
    PERFORM id FROM profiles WHERE company_id = v_wrong_company_id;
    IF NOT FOUND THEN
        DELETE FROM companies WHERE id = v_wrong_company_id;
        RAISE NOTICE 'Empresa antiga (ID: %) removida pois estava vazia.', v_wrong_company_id;
    ELSE
        RAISE NOTICE 'Empresa antiga NÃO removida pois ainda possui usuários vinculados.';
    END IF;

END $$;
