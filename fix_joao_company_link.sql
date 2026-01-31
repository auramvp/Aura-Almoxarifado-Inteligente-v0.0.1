
-- Script para corrigir a vinculação do usuário Joao à empresa correta
-- CNPJ alvo: 05.506.560/0001-36

DO $$
DECLARE
    v_company_id uuid;
    v_user_id uuid;
    v_cnpj text := '05.506.560/0001-36';
BEGIN
    -- 1. Buscar a empresa pelo CNPJ
    SELECT id INTO v_company_id 
    FROM companies 
    WHERE cnpj = v_cnpj;
    
    -- Se não existir, criar a empresa
    IF v_company_id IS NULL THEN
        INSERT INTO companies (name, cnpj, created_at)
        VALUES ('Empresa João (Auto-Criada)', v_cnpj, NOW())
        RETURNING id INTO v_company_id;
        RAISE NOTICE 'Empresa criada com ID: %', v_company_id;
    ELSE
        RAISE NOTICE 'Empresa encontrada com ID: %', v_company_id;
    END IF;

    -- 2. Buscar o usuário Joao
    SELECT id INTO v_user_id 
    FROM profiles 
    WHERE name ILIKE '%Joao%' 
    LIMIT 1;

    -- 3. Atualizar a vinculação
    IF v_user_id IS NOT NULL THEN
        UPDATE profiles 
        SET company_id = v_company_id 
        WHERE id = v_user_id;
        RAISE NOTICE 'Usuário Joao (ID: %) vinculado à empresa %', v_user_id, v_company_id;
    ELSE
        RAISE NOTICE 'Usuário Joao não encontrado.';
    END IF;
END $$;
