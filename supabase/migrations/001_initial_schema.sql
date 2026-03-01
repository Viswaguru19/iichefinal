-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'secretary',
  'program_head',
  'committee_head',
  'committee_cohead',
  'committee_member',
  'student'
);

-- Create enum for committee types
CREATE TYPE committee_type AS ENUM ('regular', 'executive');

-- Create enum for member positions
CREATE TYPE member_position AS ENUM ('head', 'co_head', 'member');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Committees table
CREATE TABLE committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type committee_type DEFAULT 'regular',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Committee members junction table
CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  position member_position DEFAULT 'member',
  designation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, committee_id)
);

-- Events table
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

-- Kickoff teams table
CREATE TABLE kickoff_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  payment_screenshot_url TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kickoff players table
CREATE TABLE kickoff_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  jersey_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kickoff matches table
CREATE TABLE kickoff_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team1_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  team2_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  team1_score INTEGER DEFAULT 0,
  team2_score INTEGER DEFAULT 0,
  match_date TIMESTAMPTZ NOT NULL,
  round TEXT DEFAULT 'group',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kickoff goals table
CREATE TABLE kickoff_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES kickoff_matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES kickoff_players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES kickoff_teams(id) ON DELETE CASCADE,
  minute INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_committee_members_user ON committee_members(user_id);
CREATE INDEX idx_committee_members_committee ON committee_members(committee_id);
CREATE INDEX idx_events_committee ON events(committee_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_kickoff_players_team ON kickoff_players(team_id);
CREATE INDEX idx_kickoff_matches_teams ON kickoff_matches(team1_id, team2_id);
CREATE INDEX idx_kickoff_goals_match ON kickoff_goals(match_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for committees (public read)
CREATE POLICY "Committees are viewable by everyone" ON committees FOR SELECT USING (true);
CREATE POLICY "Only admins can modify committees" ON committees FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- RLS Policies for committee_members (public read)
CREATE POLICY "Committee members are viewable by everyone" ON committee_members FOR SELECT USING (true);
CREATE POLICY "Only admins can modify committee members" ON committee_members FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'secretary', 'program_head'))
);

-- RLS Policies for events (public read)
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Committee members can create events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'secretary', 'program_head', 'committee_head', 'committee_cohead', 'committee_member'))
);
CREATE POLICY "Committee members can update own committee events" ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'secretary', 'program_head'))
  OR
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND committee_id = events.committee_id)
);

-- RLS Policies for kickoff (public read, restricted write)
CREATE POLICY "Kickoff teams are viewable by everyone" ON kickoff_teams FOR SELECT USING (true);
CREATE POLICY "Anyone can register a team" ON kickoff_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admins can approve teams" ON kickoff_teams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'secretary', 'program_head', 'committee_head'))
);

CREATE POLICY "Kickoff players are viewable by everyone" ON kickoff_players FOR SELECT USING (true);
CREATE POLICY "Team creators can add players" ON kickoff_players FOR INSERT WITH CHECK (true);

CREATE POLICY "Kickoff matches are viewable by everyone" ON kickoff_matches FOR SELECT USING (true);
CREATE POLICY "Only admins can manage matches" ON kickoff_matches FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'secretary', 'program_head', 'committee_head'))
);

CREATE POLICY "Kickoff goals are viewable by everyone" ON kickoff_goals FOR SELECT USING (true);
CREATE POLICY "Only admins can record goals" ON kickoff_goals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'secretary', 'program_head', 'committee_head'))
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_committees_updated_at BEFORE UPDATE ON committees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kickoff_teams_updated_at BEFORE UPDATE ON kickoff_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kickoff_matches_updated_at BEFORE UPDATE ON kickoff_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update match scores when goal is added
CREATE OR REPLACE FUNCTION update_match_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.team_id = (SELECT team1_id FROM kickoff_matches WHERE id = NEW.match_id) THEN
    UPDATE kickoff_matches SET team1_score = team1_score + 1 WHERE id = NEW.match_id;
  ELSE
    UPDATE kickoff_matches SET team2_score = team2_score + 1 WHERE id = NEW.match_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_match_score AFTER INSERT ON kickoff_goals FOR EACH ROW EXECUTE FUNCTION update_match_score();
