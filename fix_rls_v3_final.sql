
-- V3: Solução Final para RLS (Row Level Security)
-- 1. Habilitar RLS explicitamente em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- 2. Função de Segurança (SECURITY DEFINER)
-- Permite buscar o ID da empresa sem ser bloqueado por políticas da tabela profiles
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT company_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Políticas para EMPRESAS (Companies)
-- CORREÇÃO PRINCIPAL: Usar a função segura aqui também
DROP POLICY IF EXISTS "Users can view own company" ON companies;
CREATE POLICY "Users can view own company" ON companies
    FOR SELECT USING (id = get_my_company_id());

-- 4. Políticas para PERFIL (Profiles)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 5. Políticas para PRODUTOS (Products)
DROP POLICY IF EXISTS "Users can view company products" ON products;
CREATE POLICY "Users can view company products" ON products
    FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can insert company products" ON products;
CREATE POLICY "Users can insert company products" ON products
    FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update company products" ON products;
CREATE POLICY "Users can update company products" ON products
    FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can delete company products" ON products;
CREATE POLICY "Users can delete company products" ON products
    FOR DELETE USING (company_id = get_my_company_id());

-- 6. Políticas para FORNECEDORES (Suppliers)
DROP POLICY IF EXISTS "Users can view company suppliers" ON suppliers;
CREATE POLICY "Users can view company suppliers" ON suppliers
    FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can insert company suppliers" ON suppliers;
CREATE POLICY "Users can insert company suppliers" ON suppliers
    FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update company suppliers" ON suppliers;
CREATE POLICY "Users can update company suppliers" ON suppliers
    FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can delete company suppliers" ON suppliers;
CREATE POLICY "Users can delete company suppliers" ON suppliers
    FOR DELETE USING (company_id = get_my_company_id());

-- 7. Políticas para MOVIMENTAÇÕES (Stock Movements)
DROP POLICY IF EXISTS "Users can view company movements" ON stock_movements;
CREATE POLICY "Users can view company movements" ON stock_movements
    FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can insert company movements" ON stock_movements;
CREATE POLICY "Users can insert company movements" ON stock_movements
    FOR INSERT WITH CHECK (company_id = get_my_company_id());

-- 8. Políticas para AUXILIARES (Categories, Sectors, Locations)
-- Categories
DROP POLICY IF EXISTS "Users can view company categories" ON categories;
CREATE POLICY "Users can view company categories" ON categories FOR SELECT USING (company_id = get_my_company_id());
DROP POLICY IF EXISTS "Users can insert company categories" ON categories;
CREATE POLICY "Users can insert company categories" ON categories FOR INSERT WITH CHECK (company_id = get_my_company_id());
DROP POLICY IF EXISTS "Users can delete company categories" ON categories;
CREATE POLICY "Users can delete company categories" ON categories FOR DELETE USING (company_id = get_my_company_id());

-- Sectors
DROP POLICY IF EXISTS "Users can view company sectors" ON sectors;
CREATE POLICY "Users can view company sectors" ON sectors FOR SELECT USING (company_id = get_my_company_id());
DROP POLICY IF EXISTS "Users can insert company sectors" ON sectors;
CREATE POLICY "Users can insert company sectors" ON sectors FOR INSERT WITH CHECK (company_id = get_my_company_id());
DROP POLICY IF EXISTS "Users can delete company sectors" ON sectors;
CREATE POLICY "Users can delete company sectors" ON sectors FOR DELETE USING (company_id = get_my_company_id());

-- Locations
DROP POLICY IF EXISTS "Users can view company locations" ON locations;
CREATE POLICY "Users can view company locations" ON locations FOR SELECT USING (company_id = get_my_company_id());
DROP POLICY IF EXISTS "Users can insert company locations" ON locations;
CREATE POLICY "Users can insert company locations" ON locations FOR INSERT WITH CHECK (company_id = get_my_company_id());
DROP POLICY IF EXISTS "Users can delete company locations" ON locations;
CREATE POLICY "Users can delete company locations" ON locations FOR DELETE USING (company_id = get_my_company_id());
