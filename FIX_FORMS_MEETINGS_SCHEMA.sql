-- ============================================
-- FIX FORMS AND MEETINGS SCHEMA ISSUES
-- ============================================

-- Step 1: Create ENUM types if they don't exist
DO $$ BEGIN
    CREATE TYPE meeting_type AS ENUM ('online', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE meeting_platform AS ENUM ('microsoft_teams', 'google_meet', 'zoom', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Ensure forms table exists with correct schema
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Ensure form_responses table exists
CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  responses JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Ensure meetings table exists with correct schema
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_type meeting_type NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  duration INTEGER, -- in minutes
  location TEXT, -- for offline meetings
  platform meeting_platform, -- for online meetings
  meeting_link TEXT,
  created_by UUID REFERENCES profiles(id),
  committee_id UUID REFERENCES committees(id),
  participants UUID[], -- array of user IDs
  agenda TEXT,
  minutes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_by);
CREATE INDEX IF NOT EXISTS idx_form_responses_form ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_user ON form_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_committee ON meetings(committee_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

-- Step 6: Enable RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for forms
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

-- Step 8: Create RLS policies for form_responses
DROP POLICY IF EXISTS "Anyone can view form responses" ON form_responses;
CREATE POLICY "Anyone can view form responses" ON form_responses 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit responses" ON form_responses;
CREATE POLICY "Authenticated users can submit responses" ON form_responses 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Step 9: Create RLS policies for meetings
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

-- Step 10: Verify the setup
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
FROM meetings
UNION ALL
SELECT 
  'Form responses table' as table_name,
  COUNT(*) as row_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'form_responses') as column_count
FROM form_responses;

-- Show ENUM types
SELECT 
  typname as enum_name,
  array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('meeting_type', 'meeting_platform')
GROUP BY typname;

SELECT 'Schema fix completed successfully!' as status;
