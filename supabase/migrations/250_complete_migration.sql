-- Run this in Supabase SQL Editor (NOT sandboxed)
-- Go to: SQL Editor > New Query

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('super_admin','secretary','program_head','committee_head','committee_cohead','committee_member','student');
CREATE TYPE committee_type AS ENUM ('regular','executive');
CREATE TYPE member_position AS ENUM ('head','co_head','member');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type committee_type DEFAULT 'regular',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  position member_position DEFAULT 'member',
  designation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id,committee_id)
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  committee_id UUID REFERENCES committees(id) ON DELETE SET NULL,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  image_url TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kickoff_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  payment_screenshot_url TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kickoff_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  jersey_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kickoff_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team1_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  team2_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  team1_score INTEGER DEFAULT 0,
  team2_score INTEGER DEFAULT 0,
  match_date TIMESTAMPTZ NOT NULL,
  round TEXT DEFAULT 'group',
  completed BOOLEAN DEFAULT FALSE,
  winner_team_id UUID REFERENCES kickoff_teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kickoff_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES kickoff_matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES kickoff_players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  minute INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournament_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_active BOOLEAN DEFAULT FALSE,
  tournament_name TEXT DEFAULT 'Kickoff Tournament',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Committees are viewable by everyone" ON committees FOR SELECT USING (true);
CREATE POLICY "Committee members are viewable by everyone" ON committee_members FOR SELECT USING (true);
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Kickoff teams are viewable by everyone" ON kickoff_teams FOR SELECT USING (true);
CREATE POLICY "Anyone can register a team" ON kickoff_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Kickoff players are viewable by everyone" ON kickoff_players FOR SELECT USING (true);
CREATE POLICY "Team creators can add players" ON kickoff_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Kickoff matches are viewable by everyone" ON kickoff_matches FOR SELECT USING (true);
CREATE POLICY "Kickoff goals are viewable by everyone" ON kickoff_goals FOR SELECT USING (true);
CREATE POLICY "Tournament settings viewable by everyone" ON tournament_settings FOR SELECT USING (true);

INSERT INTO committees (id,name,description,type) VALUES 
('00000000-0000-0000-0000-000000000001','Executive Committee','The governing body of IIChE AVVU','executive'),
('00000000-0000-0000-0000-000000000002','Program Committee','Organizes technical and academic programs','regular'),
('00000000-0000-0000-0000-000000000003','Publicity Committee','Handles marketing and outreach activities','regular'),
('00000000-0000-0000-0000-000000000004','Sponsorship Committee','Manages sponsorships and partnerships','regular'),
('00000000-0000-0000-0000-000000000005','Design Committee','Creates visual content and designs','regular'),
('00000000-0000-0000-0000-000000000006','Editorial Committee','Manages content creation and publications','regular'),
('00000000-0000-0000-0000-000000000007','Web Development Committee','Develops and maintains digital platforms','regular'),
('00000000-0000-0000-0000-000000000008','HR Committee','Manages human resources and team coordination','regular'),
('00000000-0000-0000-0000-000000000009','Finance Committee','Handles financial planning and budgeting','regular');

INSERT INTO tournament_settings (is_active) VALUES (false);
