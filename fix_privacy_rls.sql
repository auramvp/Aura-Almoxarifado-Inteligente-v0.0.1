-- Script para garantir privacidade entre empresas (Multi-tenancy)
-- 1. Adicionar coluna company_id em todas as tabelas principais
ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 2. Tentar preencher company_id para dados existentes (Assumindo a primeira empresa criada para dados legados)
DO $$
DECLARE
    first_company_id UUID;
BEGIN
    SELECT id INTO first_company_id FROM companies ORDER BY created_at ASC LIMIT 1;
    
    IF first_company_id IS NOT NULL THEN
        UPDATE products SET company_id = first_company_id WHERE company_id IS NULL;
        UPDATE suppliers SET company_id = first_company_id WHERE company_id IS NULL;
        UPDATE sectors SET company_id = first_company_id WHERE company_id IS NULL;
        UPDATE categories SET company_id = first_company_id WHERE company_id IS NULL;
        UPDATE stock_movements SET company_id = first_company_id WHERE company_id IS NULL;
        UPDATE locations SET company_id = first_company_id WHERE company_id IS NULL;
    END IF;
END $$;

-- 3. Habilitar RLS (Row Level Security) em todas as tabelas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 4. Criar Policies de Segurança

-- PRODUCTS
DROP POLICY IF EXISTS "Users can view their own company products" ON products;
CREATE POLICY "Users can view their own company products" ON products
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own company products" ON products;
CREATE POLICY "Users can manage their own company products" ON products
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- SUPPLIERS
DROP POLICY IF EXISTS "Users can view their own company suppliers" ON suppliers;
CREATE POLICY "Users can view their own company suppliers" ON suppliers
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own company suppliers" ON suppliers;
CREATE POLICY "Users can manage their own company suppliers" ON suppliers
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- SECTORS
DROP POLICY IF EXISTS "Users can view their own company sectors" ON sectors;
CREATE POLICY "Users can view their own company sectors" ON sectors
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own company sectors" ON sectors;
CREATE POLICY "Users can manage their own company sectors" ON sectors
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view their own company categories" ON categories;
CREATE POLICY "Users can view their own company categories" ON categories
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own company categories" ON categories;
CREATE POLICY "Users can manage their own company categories" ON categories
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- STOCK MOVEMENTS
DROP POLICY IF EXISTS "Users can view their own company movements" ON stock_movements;
CREATE POLICY "Users can view their own company movements" ON stock_movements
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own company movements" ON stock_movements;
CREATE POLICY "Users can manage their own company movements" ON stock_movements
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- COMPANIES
-- Usuários só podem ver sua própria empresa
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company" ON companies
    FOR SELECT USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Permitir criação de empresa (durante registro) - Open for INSERT but restricted otherwise
DROP POLICY IF EXISTS "Users can create company" ON companies;
CREATE POLICY "Users can create company" ON companies
    FOR INSERT WITH CHECK (true);

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
