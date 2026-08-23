-- COMPLETE DATABASE SCHEMA FOR IICHE PORTAL
-- Run this in Supabase SQL Editor after deleting all old tables

-- 1. PROFILES TABLE
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  approved BOOLEAN DEFAULT false,
  executive_role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COMMITTEES TABLE
CREATE TABLE committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  head_id UUID REFERENCES profiles(id),
  cohead_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. COMMITTEE MEMBERS TABLE
CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(committee_id, user_id)
);

-- 4. EVENTS TABLE
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  location TEXT,
  committee_id UUID REFERENCES committees(id),
  approved BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. KICKOFF TEAMS TABLE
CREATE TABLE kickoff_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  captain_name TEXT,
  captain_phone TEXT,
  payment_screenshot TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. KICKOFF PLAYERS TABLE
CREATE TABLE kickoff_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  jersey_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. KICKOFF MATCHES TABLE
CREATE TABLE kickoff_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team1_id UUID REFERENCES kickoff_teams(id),
  team2_id UUID REFERENCES kickoff_teams(id),
  team1_score INTEGER DEFAULT 0,
  team2_score INTEGER DEFAULT 0,
  match_date TIMESTAMPTZ NOT NULL,
  round TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. KICKOFF GOALS TABLE
CREATE TABLE kickoff_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES kickoff_matches(id) ON DELETE CASCADE,
  team_id UUID REFERENCES kickoff_teams(id),
  player_id UUID REFERENCES kickoff_players(id),
  goal_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. STATEMENT OF ACCOUNTS TABLE
CREATE TABLE statement_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(10,2) NOT NULL,
  category TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. FORMS TABLE
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  committee_id UUID REFERENCES committees(id),
  fields JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. FORM RESPONSES TABLE
CREATE TABLE form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  responses JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. MEETINGS TABLE
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  committee_id UUID REFERENCES committees(id),
  agenda TEXT,
  minutes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DISABLE RLS (for easier setup)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE committees DISABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE statement_of_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;

-- INSERT DEFAULT COMMITTEES
INSERT INTO committees (name, description) VALUES
('Executive Committee', 'Main governing body'),
('Technical Committee', 'Technical events and workshops'),
('Cultural Committee', 'Cultural activities and events'),
('Sports Committee', 'Sports and fitness activities'),
('Media Committee', 'Social media and publicity'),
('Finance Committee', 'Financial management'),
('Hospitality Committee', 'Guest management and hospitality'),
('Documentation Committee', 'Event documentation and records'),
('Web Development Committee', 'Website and portal management');
