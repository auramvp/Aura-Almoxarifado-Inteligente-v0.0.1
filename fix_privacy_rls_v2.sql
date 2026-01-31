-- Script V2: Corrigido e Seguro para rodar múltiplas vezes
-- Este script verifica se as colunas e políticas já existem antes de tentar criar

-- 1. Adicionar colunas company_id (se ainda não existirem)
ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 2. Migrar dados antigos para a primeira empresa (caso existam dados órfãos)
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

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- 4. Recriar Políticas de Segurança (DROP IF EXISTS evita o erro que você viu)

-- Products
DROP POLICY IF EXISTS "Users can view their own company products" ON products;
DROP POLICY IF EXISTS "Users can manage their own company products" ON products;

CREATE POLICY "Users can view their own company products" ON products
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company products" ON products
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Suppliers
DROP POLICY IF EXISTS "Users can view their own company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can manage their own company suppliers" ON suppliers;

CREATE POLICY "Users can view their own company suppliers" ON suppliers
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company suppliers" ON suppliers
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Sectors
DROP POLICY IF EXISTS "Users can view their own company sectors" ON sectors;
DROP POLICY IF EXISTS "Users can manage their own company sectors" ON sectors;

CREATE POLICY "Users can view their own company sectors" ON sectors
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company sectors" ON sectors
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Categories
DROP POLICY IF EXISTS "Users can view their own company categories" ON categories;
DROP POLICY IF EXISTS "Users can manage their own company categories" ON categories;

CREATE POLICY "Users can view their own company categories" ON categories
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company categories" ON categories
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Stock Movements
DROP POLICY IF EXISTS "Users can view their own company movements" ON stock_movements;
DROP POLICY IF EXISTS "Users can manage their own company movements" ON stock_movements;

CREATE POLICY "Users can view their own company movements" ON stock_movements
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company movements" ON stock_movements
    FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Atualizar cache do schema
NOTIFY pgrst, 'reload schema';
