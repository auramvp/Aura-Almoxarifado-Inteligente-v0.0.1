-- Migration: Add company status and suspension tracking
-- This migration adds columns to track company status (active, suspended, blocked)
-- and the reason for suspension

-- Add status column with check constraint
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'suspended', 'blocked'));

-- Add suspension reason column (optional, only populated when suspended/blocked)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- Update existing companies to have 'active' status (if column was just added)
UPDATE companies 
SET status = 'active' 
WHERE status IS NULL;

COMMENT ON COLUMN companies.status IS 'Company status: active (normal operation), suspended (temporary block), blocked (permanent block)';
COMMENT ON COLUMN companies.suspension_reason IS 'Reason for suspension or blocking, shown to users when they try to access';
