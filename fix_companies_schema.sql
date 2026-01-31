-- Fix missing columns in companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_extra TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_responsible TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_whatsapp TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector_email TEXT;

-- Verify if other tables need updates (based on types.ts)
-- profiles table might need permissions
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
