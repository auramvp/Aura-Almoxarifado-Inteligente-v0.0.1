-- Comando para corrigir a restrição de papéis de usuário (Roles)
-- Execute este bloco inteiro no SQL Editor do Supabase

-- 1. Remove a restrição antiga que bloqueia novos papéis
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Adiciona a nova restrição permitindo ALMOXARIFE, AUX_ALMOXARIFE e ADMIN
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ALMOXARIFE', 'AUX_ALMOXARIFE', 'ADMIN'));
