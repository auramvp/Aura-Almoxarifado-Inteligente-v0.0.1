
-- V4: Script de Emergência e Permissões Explícitas

-- 1. Garantir permissões de tabela para o role 'authenticated'
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2. Garantir permissões para 'anon' (caso o debug dependa disso)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. REMOVER temporariamente a verificação de empresa na política (RLS)
-- Isso vai isolar se o problema é a lógica da função get_my_company_id()
DROP POLICY IF EXISTS "Users can view company products" ON products;
CREATE POLICY "Emergency Public Access" ON products
    FOR SELECT
    USING (true); -- Permite ver TUDO (o filtro de empresa será feito pelo front-end)

-- 4. Fazer o mesmo para Profiles e Companies para garantir que não é lá o bloqueio
DROP POLICY IF EXISTS "Users can view own company" ON companies;
CREATE POLICY "Emergency Company Access" ON companies
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Emergency Profile Access" ON profiles
    FOR SELECT USING (true);

-- Nota: Isso é temporário para confirmar se o problema é a regra de RLS.
-- Se os dados aparecerem, sabemos que a função get_my_company_id() estava falhando.
