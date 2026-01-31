
-- Script para corrigir a vinculação do usuário Joao
-- O objetivo é vinculá-lo à MESMA empresa do usuário 'contato.auramvp@gmail.com'

DO $$
DECLARE
    v_parent_email text := 'contato.auramvp@gmail.com';
    v_target_company_id uuid;
    v_user_id uuid;
    v_wrong_company_id uuid;
BEGIN
    -- 1. Descobrir a empresa correta (do usuário pai/admin)
    SELECT company_id INTO v_target_company_id
    FROM profiles
    WHERE email = v_parent_email
    LIMIT 1;

    IF v_target_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa do usuário % não encontrada!', v_parent_email;
    END IF;

    RAISE NOTICE 'ID da empresa correta (do admin): %', v_target_company_id;

    -- 2. Identificar o usuário Joao
    SELECT id, company_id INTO v_user_id, v_wrong_company_id
    FROM profiles
    WHERE name ILIKE '%Joao%'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário Joao não encontrado!';
    END IF;

    -- 3. Atualizar o usuário Joao para a empresa correta
    UPDATE profiles
    SET company_id = v_target_company_id
    WHERE id = v_user_id;

    RAISE NOTICE 'Usuário Joao (ID: %) movido para a empresa ID: %', v_user_id, v_target_company_id;

    -- 4. Opcional: Limpar a empresa criada erroneamente (se for diferente da correta e estiver vazia/auto-criada)
    -- Verificamos se o nome é aquele que criamos automaticamente
    IF v_wrong_company_id IS NOT NULL AND v_wrong_company_id != v_target_company_id THEN
        DELETE FROM companies 
        WHERE id = v_wrong_company_id 
        AND name = 'Empresa João (Auto-Criada)';
        
        IF FOUND THEN
            RAISE NOTICE 'Empresa temporária incorreta (ID: %) foi removida.', v_wrong_company_id;
        END IF;
    END IF;

END $$;
