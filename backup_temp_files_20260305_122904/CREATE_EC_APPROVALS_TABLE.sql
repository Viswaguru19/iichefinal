-- ============================================
-- CREATE EC_APPROVALS TABLE
-- Track individual EC member approvals
-- ============================================

-- Create ec_approvals table
CREATE TABLE IF NOT EXISTS ec_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ec_approvals_event_id ON ec_approvals(event_id);
CREATE INDEX IF NOT EXISTS idx_ec_approvals_user_id ON ec_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_ec_approvals_approved ON ec_approvals(approved) WHERE approved = true;

-- Add comments
COMMENT ON TABLE ec_approvals IS 'Tracks individual EC member approvals for events';
COMMENT ON COLUMN ec_approvals.event_id IS 'Reference to the event being approved';
COMMENT ON COLUMN ec_approvals.user_id IS 'EC member who is approving';
COMMENT ON COLUMN ec_approvals.approved IS 'Whether the EC member approved (true) or rejected (false)';
COMMENT ON COLUMN ec_approvals.approved_at IS 'Timestamp when approval was given';
COMMENT ON COLUMN ec_approvals.rejection_reason IS 'Reason if EC member rejected';

-- Enable RLS
ALTER TABLE ec_approvals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "EC members can view all approvals" ON ec_approvals;
DROP POLICY IF EXISTS "EC members can insert their own approvals" ON ec_approvals;
DROP POLICY IF EXISTS "EC members can update their own approvals" ON ec_approvals;
DROP POLICY IF EXISTS "Admins can manage all approvals" ON ec_approvals;
DROP POLICY IF EXISTS "Everyone can view approvals" ON ec_approvals;

-- RLS Policies

-- Everyone can view approvals (needed for displaying approval progress)
CREATE POLICY "Everyone can view approvals"
ON ec_approvals FOR SELECT
USING (true);

-- EC members can insert their own approvals
CREATE POLICY "EC members can insert their own approvals"
ON ec_approvals FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
  )
);

-- EC members can update their own approvals
CREATE POLICY "EC members can update their own approvals"
ON ec_approvals FOR UPDATE
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
  )
);

-- Admins can manage all approvals
CREATE POLICY "Admins can manage all approvals"
ON ec_approvals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'super_admin' OR profiles.is_admin = true)
  )
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ EC_APPROVALS TABLE CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Table: ec_approvals';
  RAISE NOTICE 'Purpose: Track individual EC member approvals';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '✅ Tracks which EC members approved each event';
  RAISE NOTICE '✅ Prevents duplicate approvals (unique constraint)';
  RAISE NOTICE '✅ Cascading delete when event is deleted';
  RAISE NOTICE '✅ RLS policies for security';
  RAISE NOTICE '✅ Indexes for performance';
  RAISE NOTICE '';
  RAISE NOTICE 'EC Approval Workflow:';
  RAISE NOTICE '1. Event reaches pending_ec_approval status';
  RAISE NOTICE '2. EC members can approve (record in ec_approvals)';
  RAISE NOTICE '3. When 2 EC members approve, event becomes active';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
