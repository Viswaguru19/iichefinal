-- Ensure form_responses has both submitted_at and created_at columns
-- Some migrations created the table with submitted_at, others with created_at

-- Add submitted_at if it doesn't exist (alias for created_at)
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: copy values between columns where one is null
UPDATE form_responses SET submitted_at = created_at WHERE submitted_at IS NULL AND created_at IS NOT NULL;
UPDATE form_responses SET created_at = submitted_at WHERE created_at IS NULL AND submitted_at IS NOT NULL;
