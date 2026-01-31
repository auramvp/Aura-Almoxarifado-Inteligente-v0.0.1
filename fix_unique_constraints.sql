-- Corrigir restrições UNIQUE para funcionar com Multi-Tenancy (Várias Empresas)
-- Antes: O código '001' era único em TODO o sistema (uma empresa bloqueava a outra).
-- Depois: O código '001' será único apenas DENTRO da mesma empresa.

-- 1. Produtos (Código deve ser único por empresa)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_cod_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_company_id_cod_key; -- Garante limpeza antes de criar
ALTER TABLE products ADD CONSTRAINT products_company_id_cod_key UNIQUE (company_id, cod);

-- 2. Categorias (Nome deve ser único por empresa)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_company_id_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_company_id_name_key UNIQUE (company_id, name);

-- 3. Setores (Nome deve ser único por empresa)
ALTER TABLE sectors DROP CONSTRAINT IF EXISTS sectors_name_key;
ALTER TABLE sectors DROP CONSTRAINT IF EXISTS sectors_company_id_name_key;
ALTER TABLE sectors ADD CONSTRAINT sectors_company_id_name_key UNIQUE (company_id, name);

-- 4. Fornecedores (CNPJ deve ser único por empresa - cada empresa tem seu cadastro de fornecedores)
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_cnpj_key;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_company_id_cnpj_key;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_company_id_cnpj_key UNIQUE (company_id, cnpj);

NOTIFY pgrst, 'reload schema';
