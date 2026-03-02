-- Create hiring_applications table
CREATE TABLE IF NOT EXISTS hiring_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID NOT NULL REFERENCES hiring_positions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  resume TEXT NOT NULL,
  cover_letter TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_hiring_applications_position ON hiring_applications(position_id);
CREATE INDEX idx_hiring_applications_status ON hiring_applications(status);

-- Enable RLS
ALTER TABLE hiring_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit applications
CREATE POLICY "Anyone can submit applications"
  ON hiring_applications FOR INSERT
  WITH CHECK (true);

-- Allow Social Committee and super_admin to view applications
CREATE POLICY "Social Committee can view applications"
  ON hiring_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN committee_members cm ON p.id = cm.user_id
      LEFT JOIN committees c ON cm.committee_id = c.id
      WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR c.name = 'Social Committee')
    )
  );

-- Allow Social Committee and super_admin to update application status
CREATE POLICY "Social Committee can update applications"
  ON hiring_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN committee_members cm ON p.id = cm.user_id
      LEFT JOIN committees c ON cm.committee_id = c.id
      WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR c.name = 'Social Committee')
    )
  );

-- Update hiring_positions RLS to allow Social Committee to manage
DROP POLICY IF EXISTS "Only super_admin can manage positions" ON hiring_positions;

CREATE POLICY "Social Committee can manage positions"
  ON hiring_positions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN committee_members cm ON p.id = cm.user_id
      LEFT JOIN committees c ON cm.committee_id = c.id
      WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR c.name = 'Social Committee')
    )
  );

-- Update hiring_settings RLS
DROP POLICY IF EXISTS "Only super_admin can manage settings" ON hiring_settings;

CREATE POLICY "Social Committee can manage settings"
  ON hiring_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN committee_members cm ON p.id = cm.user_id
      LEFT JOIN committees c ON cm.committee_id = c.id
      WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR c.name = 'Social Committee')
    )
  );
