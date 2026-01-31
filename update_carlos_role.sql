
-- 1. Atualizar o role do usuário Carlos Gabriel para ALMOXARIFE
UPDATE profiles
SET role = 'ALMOXARIFE'
WHERE email = 'carlosgabriel.camppos@gmail.com';

-- 2. Reforçar o company_id correto (embora já pareça estar certo)
UPDATE profiles
SET company_id = 'dce86f24-1154-43e8-8b27-1a9c6fe2ce8a'
WHERE email = 'carlosgabriel.camppos@gmail.com';

-- 3. Habilitar RLS em profiles se não estiver (segurança)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Reaplicar política de perfil simples e direta
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
