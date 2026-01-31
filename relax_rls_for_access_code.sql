
-- Script para ajustar permissões RLS (Row Level Security)
-- Permite que usuários com login simplificado (Código de Acesso) acessem os dados.
-- A segurança/isolamento será garantida pelo filtro company_id na aplicação.

-- 1. COMPANIES
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can create company" ON companies;
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Public insert companies" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update companies" ON companies FOR UPDATE USING (true);

-- 2. PRODUCTS
DROP POLICY IF EXISTS "Users can view their own company products" ON products;
DROP POLICY IF EXISTS "Users can manage their own company products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public manage products" ON products FOR ALL USING (true);

-- 3. SUPPLIERS
DROP POLICY IF EXISTS "Users can view their own company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can manage their own company suppliers" ON suppliers;
CREATE POLICY "Public read suppliers" ON suppliers FOR SELECT USING (true);
CREATE POLICY "Public manage suppliers" ON suppliers FOR ALL USING (true);

-- 4. SECTORS
DROP POLICY IF EXISTS "Users can view their own company sectors" ON sectors;
DROP POLICY IF EXISTS "Users can manage their own company sectors" ON sectors;
CREATE POLICY "Public read sectors" ON sectors FOR SELECT USING (true);
CREATE POLICY "Public manage sectors" ON sectors FOR ALL USING (true);

-- 5. CATEGORIES
DROP POLICY IF EXISTS "Users can view their own company categories" ON categories;
DROP POLICY IF EXISTS "Users can manage their own company categories" ON categories;
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public manage categories" ON categories FOR ALL USING (true);

-- 6. STOCK MOVEMENTS
DROP POLICY IF EXISTS "Users can view their own company movements" ON stock_movements;
DROP POLICY IF EXISTS "Users can manage their own company movements" ON stock_movements;
CREATE POLICY "Public read movements" ON stock_movements FOR SELECT USING (true);
CREATE POLICY "Public manage movements" ON stock_movements FOR ALL USING (true);

-- 7. LOCATIONS
DROP POLICY IF EXISTS "Users can view their own company locations" ON locations;
DROP POLICY IF EXISTS "Users can manage their own company locations" ON locations;
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Public manage locations" ON locations FOR ALL USING (true);

-- 8. PROFILES (Garantir acesso ao próprio perfil e outros da mesma empresa)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public update profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Public insert profiles" ON profiles FOR INSERT WITH CHECK (true);

-- Notificar recarga
NOTIFY pgrst, 'reload schema';
