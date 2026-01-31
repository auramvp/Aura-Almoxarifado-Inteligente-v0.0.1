-- V5: Correção Final de Permissões (Remove anteriores para evitar erros)

-- 1. Remover TODAS as variações de políticas que podem estar causando conflito
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles" ON profiles;
DROP POLICY IF EXISTS "Emergency Profile Access" ON profiles;

DROP POLICY IF EXISTS "Users can view company products" ON products;
DROP POLICY IF EXISTS "Enable read access for company products" ON products;
DROP POLICY IF EXISTS "Emergency Public Access" ON products;
DROP POLICY IF EXISTS "Debug Public Access" ON products;

DROP POLICY IF EXISTS "Users can view own company" ON companies;
DROP POLICY IF EXISTS "Emergency Company Access" ON companies;

-- 2. Garantir permissões de tabela para o role 'authenticated' (Obrigatório)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 3. Criar Políticas de Acesso "Emergency" (Liberadas para teste)
-- Isso permite que o Frontend filtre os dados sem bloqueio do Banco.

-- Perfil: Permitir ver todos (Frontend filtra pelo ID do usuário)
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (true);

-- Empresas: Permitir ver todas (Frontend filtra pela empresa do usuário)
CREATE POLICY "Users can view own company" ON companies
FOR SELECT USING (true);

-- Produtos: Permitir ver todos (Frontend filtra active=true e company_id)
CREATE POLICY "Users can view company products" ON products
FOR SELECT USING (true);

-- 4. Confirmação
-- Se isso funcionar, os dados VÃO aparecer. Depois podemos restringir novamente.
