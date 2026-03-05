-- QUICK SETUP SCRIPT FOR IICHE PORTAL
-- Copy and paste this entire script into Supabase SQL Editor and click "Run"
-- This will create the minimum tables needed to login

-- 1. Create profiles table with ALL required columns
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'student',
  approved BOOLEAN DEFAULT false,
  is_faculty BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  avatar_url TEXT,
  phone TEXT,
  year INTEGER,
  branch TEXT,
  executive_role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Anyone can insert profile"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- 4. Create committees table (needed for dashboard)
CREATE TABLE IF NOT EXISTS committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Insert default committees
INSERT INTO committees (name, type, description) VALUES
  ('Technical Committee', 'regular', 'Handles technical events and workshops'),
  ('Marketing Committee', 'regular', 'Manages publicity and outreach'),
  ('Finance Committee', 'regular', 'Handles budgets and sponsorships')
ON CONFLICT DO NOTHING;

-- 6. Create events table (needed for progress page)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ,
  venue TEXT,
  committee_id UUID REFERENCES committees(id),
  proposed_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_head_approval',
  head_approved_by UUID REFERENCES profiles(id),
  head_approved_at TIMESTAMPTZ,
  faculty_approved_by UUID REFERENCES profiles(id),
  faculty_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create tasks table (needed for progress tracking)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  assigned_to_committee_id UUID REFERENCES committees(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'not_started',
  priority TEXT DEFAULT 'medium',
  deadline TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS on all tables
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 9. Create permissive policies for testing (you can make these stricter later)
CREATE POLICY "Anyone can read committees"
  ON committees FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read events"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read tasks"
  ON tasks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Done! You can now login and use the portal
