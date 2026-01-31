-- Atualização completa da tabela companies
-- Adiciona todas as colunas necessárias para o cadastro completo
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_responsible TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_whatsapp TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_extra TEXT;

-- Atualização da tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code VARCHAR(4);

-- Recarregar o cache do schema (Isso é feito automaticamente pelo Supabase após alterações DDL, 
-- mas é bom saber que é necessário para que a API reconheça as novas colunas imediatamente)
NOTIFY pgrst, 'reload schema';
