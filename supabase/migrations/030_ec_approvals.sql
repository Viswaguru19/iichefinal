-- ============================================
-- EC APPROVALS TABLE
-- For tracking individual EC member approvals
-- ============================================

CREATE TABLE IF NOT EXISTS ec_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_ec_approvals_event ON ec_approvals(event_id);
CREATE INDEX idx_ec_approvals_user ON ec_approvals(user_id);

-- Enable RLS
ALTER TABLE ec_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "EC members can view all approvals"
  ON ec_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.executive_role IS NOT NULL
    )
  );

CREATE POLICY "EC members can insert their own approvals"
  ON ec_approvals FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.executive_role IS NOT NULL
    )
  );

CREATE POLICY "EC members can update their own approvals"
  ON ec_approvals FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE ec_approvals IS 'Tracks individual EC member approvals for events';
