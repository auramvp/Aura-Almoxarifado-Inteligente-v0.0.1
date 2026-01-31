-- Comando para adicionar a coluna de código de acesso na tabela de perfis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code VARCHAR(4);
