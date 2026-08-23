-- Hiring Settings Table
CREATE TABLE IF NOT EXISTS hiring_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO hiring_settings (is_active) VALUES (false) ON CONFLICT DO NOTHING;

-- Hiring Positions Table
CREATE TABLE IF NOT EXISTS hiring_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  location TEXT,
  deadline DATE,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hiring_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_positions ENABLE ROW LEVEL SECURITY;

-- Policies for hiring_settings
CREATE POLICY "Anyone can view hiring settings"
  ON hiring_settings FOR SELECT
  USING (true);

CREATE POLICY "Super admin and HR can update hiring settings"
  ON hiring_settings FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'super_admin'
      UNION
      SELECT user_id FROM committee_members 
      WHERE committee_id IN (SELECT id FROM committees WHERE name = 'Social Committee')
    )
  );

-- Policies for hiring_positions
CREATE POLICY "Anyone can view open positions"
  ON hiring_positions FOR SELECT
  USING (true);

CREATE POLICY "Super admin and HR can insert positions"
  ON hiring_positions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'super_admin'
      UNION
      SELECT user_id FROM committee_members 
      WHERE committee_id IN (SELECT id FROM committees WHERE name = 'Social Committee')
    )
  );

CREATE POLICY "Super admin and HR can update positions"
  ON hiring_positions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'super_admin'
      UNION
      SELECT user_id FROM committee_members 
      WHERE committee_id IN (SELECT id FROM committees WHERE name = 'Social Committee')
    )
  );

CREATE POLICY "Super admin and HR can delete positions"
  ON hiring_positions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'super_admin'
      UNION
      SELECT user_id FROM committee_members 
      WHERE committee_id IN (SELECT id FROM committees WHERE name = 'Social Committee')
    )
  );
