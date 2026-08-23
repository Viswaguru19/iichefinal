-- ============================================
-- FIX MEETINGS TABLE - SIMPLE AND DIRECT
-- Run this to fix the meetings table issue
-- ============================================

-- Step 1: Check if meetings table exists
SELECT 
  'Checking meetings table...' as status,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meetings') as table_exists;

-- Step 2: Show current meetings table structure (if exists)
SELECT 
  'Current meetings columns:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
ORDER BY ordinal_position;

-- Step 3: Drop and recreate meetings table with correct schema
-- This is the safest approach if the table has wrong structure
DROP TABLE IF EXISTS meetings CASCADE;

-- Step 4: Create ENUM types (safe - won't error if exists)
DO $$ BEGIN
    CREATE TYPE meeting_type AS ENUM ('online', 'offline');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'meeting_type already exists';
END $$;

DO $$ BEGIN
    CREATE TYPE meeting_platform AS ENUM ('microsoft_teams', 'google_meet', 'zoom', 'other');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'meeting_platform already exists';
END $$;

-- Step 5: Create meetings table with correct schema
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

-- Step 6: Create indexes
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_committee ON meetings(committee_id);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);

-- Step 7: Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies
CREATE POLICY "Anyone can view meetings" ON meetings 
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create meetings" ON meetings 
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update own meetings" ON meetings 
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Committee members can update committee meetings" ON meetings 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM committee_members 
      WHERE user_id = auth.uid() 
      AND committee_id = meetings.committee_id
    )
  );

CREATE POLICY "Admins can manage all meetings" ON meetings 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Step 9: Verify the fix
SELECT 
  'Meetings table structure:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings'
ORDER BY ordinal_position;

-- Show ENUM types
SELECT 
  'ENUM types:' as info,
  typname as enum_name,
  array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('meeting_type', 'meeting_platform')
GROUP BY typname;

SELECT '✅ Meetings table fixed successfully!' as status;
