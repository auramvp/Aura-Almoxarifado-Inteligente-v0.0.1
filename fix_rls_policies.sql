
-- 1. PERFIL: Garantir que usuários possam ver seu próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- 2. EMPRESAS: Garantir que usuários possam ver sua própria empresa
DROP POLICY IF EXISTS "Users can view own company" ON companies;
CREATE POLICY "Users can view own company" ON companies
    FOR SELECT
    USING (
        id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- 3. PRODUTOS: Ver produtos da sua empresa
DROP POLICY IF EXISTS "Users can view company products" ON products;
CREATE POLICY "Users can view company products" ON products
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert company products" ON products;
CREATE POLICY "Users can insert company products" ON products
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update company products" ON products;
CREATE POLICY "Users can update company products" ON products
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete company products" ON products;
CREATE POLICY "Users can delete company products" ON products
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- 4. FORNECEDORES
DROP POLICY IF EXISTS "Users can view company suppliers" ON suppliers;
CREATE POLICY "Users can view company suppliers" ON suppliers
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company suppliers" ON suppliers;
CREATE POLICY "Users can insert company suppliers" ON suppliers
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update company suppliers" ON suppliers;
CREATE POLICY "Users can update company suppliers" ON suppliers
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete company suppliers" ON suppliers;
CREATE POLICY "Users can delete company suppliers" ON suppliers
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 5. MOVIMENTAÇÕES (Stock Movements)
DROP POLICY IF EXISTS "Users can view company movements" ON stock_movements;
CREATE POLICY "Users can view company movements" ON stock_movements
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company movements" ON stock_movements;
CREATE POLICY "Users can insert company movements" ON stock_movements
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 6. AUXILIARES (Categories, Sectors, Locations)
DROP POLICY IF EXISTS "Users can view company categories" ON categories;
CREATE POLICY "Users can view company categories" ON categories
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company categories" ON categories;
CREATE POLICY "Users can insert company categories" ON categories
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete company categories" ON categories;
CREATE POLICY "Users can delete company categories" ON categories
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view company sectors" ON sectors;
CREATE POLICY "Users can view company sectors" ON sectors
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company sectors" ON sectors;
CREATE POLICY "Users can insert company sectors" ON sectors
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete company sectors" ON sectors;
CREATE POLICY "Users can delete company sectors" ON sectors
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view company locations" ON locations;
CREATE POLICY "Users can view company locations" ON locations
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert company locations" ON locations;
CREATE POLICY "Users can insert company locations" ON locations
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete company locations" ON locations;
CREATE POLICY "Users can delete company locations" ON locations
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
