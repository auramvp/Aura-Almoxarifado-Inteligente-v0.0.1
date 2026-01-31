
-- Função auxiliar segura para obter o ID da empresa do usuário atual
-- SECURITY DEFINER garante que a função rode com privilégios de superusuário (ou dono),
-- contornando restrições de RLS na tabela profiles durante a execução da política.
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT company_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. PRODUTOS
DROP POLICY IF EXISTS "Users can view company products" ON products;
DROP POLICY IF EXISTS "Users can insert company products" ON products;
DROP POLICY IF EXISTS "Users can update company products" ON products;
DROP POLICY IF EXISTS "Users can delete company products" ON products;

CREATE POLICY "Users can view company products" ON products
    FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "Users can insert company products" ON products
    FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Users can update company products" ON products
    FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "Users can delete company products" ON products
    FOR DELETE USING (company_id = get_my_company_id());

-- 2. FORNECEDORES
DROP POLICY IF EXISTS "Users can view company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can insert company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can update company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can delete company suppliers" ON suppliers;

CREATE POLICY "Users can view company suppliers" ON suppliers
    FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "Users can insert company suppliers" ON suppliers
    FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Users can update company suppliers" ON suppliers
    FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "Users can delete company suppliers" ON suppliers
    FOR DELETE USING (company_id = get_my_company_id());

-- 3. MOVIMENTAÇÕES
DROP POLICY IF EXISTS "Users can view company movements" ON stock_movements;
DROP POLICY IF EXISTS "Users can insert company movements" ON stock_movements;

CREATE POLICY "Users can view company movements" ON stock_movements
    FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "Users can insert company movements" ON stock_movements
    FOR INSERT WITH CHECK (company_id = get_my_company_id());

-- 4. CATEGORIAS, SETORES, LOCAIS
-- Categories
DROP POLICY IF EXISTS "Users can view company categories" ON categories;
CREATE POLICY "Users can view company categories" ON categories FOR SELECT USING (company_id = get_my_company_id());
-- Sectors
DROP POLICY IF EXISTS "Users can view company sectors" ON sectors;
CREATE POLICY "Users can view company sectors" ON sectors FOR SELECT USING (company_id = get_my_company_id());
-- Locations
DROP POLICY IF EXISTS "Users can view company locations" ON locations;
CREATE POLICY "Users can view company locations" ON locations FOR SELECT USING (company_id = get_my_company_id());

-- 5. PERFIL (Garantir o básico)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
