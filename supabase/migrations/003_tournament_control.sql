-- Add tournament settings table for on/off control
CREATE TABLE tournament_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_active BOOLEAN DEFAULT FALSE,
  tournament_name TEXT DEFAULT 'Kickoff Tournament',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO tournament_settings (is_active) VALUES (false);

-- Add winner tracking to matches
ALTER TABLE kickoff_matches ADD COLUMN winner_team_id UUID REFERENCES kickoff_teams(id);

-- RLS for tournament settings
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournament settings viewable by everyone" ON tournament_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can modify tournament settings" ON tournament_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'secretary', 'program_head'))
);

-- Function to get tournament status
CREATE OR REPLACE FUNCTION get_tournament_status()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT is_active FROM tournament_settings LIMIT 1);
END;
$$ LANGUAGE plpgsql;
