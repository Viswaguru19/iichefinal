-- ============================================
-- FINAL FIX FOR FORMS AND MEETINGS
-- Copy and run this entire file in Supabase SQL Editor
-- ============================================

-- Step 1: Create ENUM types (safe - won't error if exists)
DO $$ BEGIN
    CREATE TYPE meeting_type AS ENUM ('online', 'offline');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'meeting_type already exists, skipping';
END $$;

DO $$ BEGIN
    CREATE TYPE meeting_platform AS ENUM ('microsoft_teams', 'google_meet', 'zoom', 'other');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'meeting_platform already exists, skipping';
END $$;

-- Step 2: Check if forms table exists and has correct structure
DO $$ 
BEGIN
    -- Add fields column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'forms' AND column_name = 'fields'
    ) THEN
        ALTER TABLE forms ADD COLUMN fields JSONB NOT NULL DEFAULT '[]';
        RAISE NOTICE 'Added fields column to forms table';
    END IF;

    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'forms' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE forms ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active column to forms table';
    END IF;
END $$;

-- Step 3: Check if meetings table exists and has correct structure
DO $$ 
BEGIN
    -- Check if meetings table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meetings') THEN
        -- Create meetings table
        CREATE TABLE meetings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          meeting_type meeting_type NOT NULL,
          meeting_date TIMESTAMPTZ NOT NULL,
          duration INTEGER,
          location TEXT,
          platform meeting_platform,
          meeting_link TEXT,
          created_by UUID REFERENCES profiles(id),
          committee_id UUID REFERENCES committees(id),
          participants UUID[],
          agenda TEXT,
          minutes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created meetings table';
    ELSE
        RAISE NOTICE 'Meetings table already exists';
    END IF;
END $$;

-- Step 4: Create indexes (safe - IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_committee ON meetings(committee_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

-- Step 5: Enable RLS (safe - won't error if already enabled)
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies (drop first to avoid conflicts)
-- Forms policies
DROP POLICY IF EXISTS "Anyone can view active forms" ON forms;
CREATE POLICY "Anyone can view active forms" ON forms 
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can create forms" ON forms;
CREATE POLICY "Authenticated users can create forms" ON forms 
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creators can update own forms" ON forms;
CREATE POLICY "Creators can update own forms" ON forms 
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can manage all forms" ON forms;
CREATE POLICY "Admins can manage all forms" ON forms 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Meetings policies
DROP POLICY IF EXISTS "Anyone can view meetings" ON meetings;
CREATE POLICY "Anyone can view meetings" ON meetings 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create meetings" ON meetings;
CREATE POLICY "Authenticated users can create meetings" ON meetings 
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creators can update own meetings" ON meetings;
CREATE POLICY "Creators can update own meetings" ON meetings 
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Committee members can update committee meetings" ON meetings;
CREATE POLICY "Committee members can update committee meetings" ON meetings 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM committee_members 
      WHERE user_id = auth.uid() 
      AND committee_id = meetings.committee_id
    )
  );

DROP POLICY IF EXISTS "Admins can manage all meetings" ON meetings;
CREATE POLICY "Admins can manage all meetings" ON meetings 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Step 7: Verify setup
SELECT 
  'Forms table' as table_name,
  COUNT(*) as row_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'forms') as column_count
FROM forms
UNION ALL
SELECT 
  'Meetings table' as table_name,
  COUNT(*) as row_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'meetings') as column_count
FROM meetings;

-- Show ENUM types
SELECT 
  typname as enum_name,
  array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('meeting_type', 'meeting_platform')
GROUP BY typname;

-- Show forms columns
SELECT 
  'Forms columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'forms'
ORDER BY ordinal_position;

-- Show meetings columns
SELECT 
  'Meetings columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings'
ORDER BY ordinal_position;

SELECT '✅ Schema fix completed successfully!' as status;
