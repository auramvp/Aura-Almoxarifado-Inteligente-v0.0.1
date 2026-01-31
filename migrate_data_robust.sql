
-- Script Robusto para migrar dados, tratando duplicidades de CNPJ/Nome
-- Empresa Correta (NIC. BR / Joao): 76c36f15-7759-467d-9b74-5424b5fdd00e
-- Empresa Antiga (Fantasma): dce86f24-1154-43e8-8b27-1a9c6fe2ce8a

DO $$
DECLARE
    v_correct_company_id uuid := '76c36f15-7759-467d-9b74-5424b5fdd00e';
    v_wrong_company_id uuid := 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a';
    r RECORD;
    v_existing_id uuid;
BEGIN
    ---------------------------------------------------------------------------
    -- 1. Tratar FORNECEDORES (Suppliers) - Unique Constraint (company_id, cnpj)
    ---------------------------------------------------------------------------
    -- Para cada fornecedor na empresa antiga...
    FOR r IN SELECT * FROM suppliers WHERE company_id = v_wrong_company_id LOOP
        
        -- Verificar se já existe um fornecedor com mesmo CNPJ na empresa correta
        SELECT id INTO v_existing_id 
        FROM suppliers 
        WHERE company_id = v_correct_company_id 
        AND cnpj = r.cnpj;
        
        IF v_existing_id IS NOT NULL THEN
            UPDATE products SET default_supplier_id = v_existing_id WHERE default_supplier_id = r.id;
            UPDATE stock_movements SET supplier_id = v_existing_id WHERE supplier_id = r.id;
            DELETE FROM suppliers WHERE id = r.id;
            RAISE NOTICE 'Fornecedor duplicado (CNPJ: %) fundido e removido.', r.cnpj;
        ELSE
            -- Se NÃO EXISTE: Apenas atualiza o company_id
            UPDATE suppliers 
            SET company_id = v_correct_company_id 
            WHERE id = r.id;
        END IF;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 2. Tratar CATEGORIAS (Categories) - Unique Constraint (company_id, name)
    ---------------------------------------------------------------------------
    FOR r IN SELECT * FROM categories WHERE company_id = v_wrong_company_id LOOP
        SELECT id INTO v_existing_id 
        FROM categories 
        WHERE company_id = v_correct_company_id 
        AND name = r.name;
        
        IF v_existing_id IS NOT NULL THEN
            UPDATE products SET category_id = v_existing_id WHERE category_id = r.id;
            DELETE FROM categories WHERE id = r.id;
            RAISE NOTICE 'Categoria duplicada (%) fundida e removida.', r.name;
        ELSE
            UPDATE categories SET company_id = v_correct_company_id WHERE id = r.id;
        END IF;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 3. Tratar LOCAIS (Locations) - Unique Constraint (company_id, name)
    ---------------------------------------------------------------------------
    FOR r IN SELECT * FROM locations WHERE company_id = v_wrong_company_id LOOP
        SELECT id INTO v_existing_id 
        FROM locations 
        WHERE company_id = v_correct_company_id 
        AND name = r.name;
        
        IF v_existing_id IS NOT NULL THEN
            -- UPDATE products SET location_id = v_existing_id WHERE location_id = r.id; -- products table has storage_location string, not ID
            DELETE FROM locations WHERE id = r.id;
            RAISE NOTICE 'Local duplicado (%) fundido e removido.', r.name;
        ELSE
            UPDATE locations SET company_id = v_correct_company_id WHERE id = r.id;
        END IF;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 4. Tratar SETORES (Sectors) - Unique Constraint (company_id, name)
    ---------------------------------------------------------------------------
    FOR r IN SELECT * FROM sectors WHERE company_id = v_wrong_company_id LOOP
        SELECT id INTO v_existing_id 
        FROM sectors 
        WHERE company_id = v_correct_company_id 
        AND name = r.name;
        
        IF v_existing_id IS NOT NULL THEN
            UPDATE stock_movements SET sector_id = v_existing_id WHERE sector_id = r.id;
            DELETE FROM sectors WHERE id = r.id; -- Setores raramente tem FKs críticas além de profiles/logs
            RAISE NOTICE 'Setor duplicado (%) removido.', r.name;
        ELSE
            UPDATE sectors SET company_id = v_correct_company_id WHERE id = r.id;
        END IF;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 5. Migrar PRODUTOS (Products)
    ---------------------------------------------------------------------------
    -- Produtos podem ter código duplicado também? Se sim, vamos renomear ou pular.
    -- Vamos assumir update direto, se der erro, teremos que tratar similar acima.
    UPDATE products 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;

    ---------------------------------------------------------------------------
    -- 6. Migrar MOVIMENTAÇÕES (Stock Movements)
    ---------------------------------------------------------------------------
    UPDATE stock_movements 
    SET company_id = v_correct_company_id 
    WHERE company_id = v_wrong_company_id;

    ---------------------------------------------------------------------------
    -- 7. Limpeza Final
    ---------------------------------------------------------------------------
    PERFORM id FROM profiles WHERE company_id = v_wrong_company_id;
    IF NOT FOUND THEN
        DELETE FROM companies WHERE id = v_wrong_company_id;
        RAISE NOTICE 'Empresa antiga removida com sucesso.';
    END IF;

END $$;
