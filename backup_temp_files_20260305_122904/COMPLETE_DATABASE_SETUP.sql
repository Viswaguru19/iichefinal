-- ============================================
-- COMPLETE DATABASE SETUP
-- Run this if you haven't run any SQL scripts yet
-- OR run individual scripts in the order shown below
-- ============================================

-- ============================================
-- STEP 1: ADD ENUM VALUES
-- ============================================

DO $
BEGIN
  -- Add pending_ec_approval
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pending_ec_approval' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'pending_ec_approval';
    RAISE NOTICE '✅ Added pending_ec_approval';
  END IF;

  -- Add rejected_by_head
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'rejected_by_head' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'rejected_by_head';
    RAISE NOTICE '✅ Added rejected_by_head';
  END IF;

  -- Add active
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'active' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'active';
    RAISE NOTICE '✅ Added active';
  END IF;

  RAISE NOTICE '✅ STEP 1 COMPLETE: Enum values added';
END $;

-- ============================================
-- STEP 2: ADD COLUMNS TO EVENTS TABLE
-- ============================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS head_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS head_rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ec_revoke_reason TEXT,
ADD COLUMN IF NOT EXISTS ec_revoked_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS ec_revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_head_rejected ON events(status) WHERE status = 'rejected_by_head';

DO $ BEGIN RAISE NOTICE '✅ STEP 2 COMPLETE: Event columns added'; END $;

-- ============================================
-- STEP 3: CREATE EC_APPROVALS TABLE
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_ec_approvals_event_id ON ec_approvals(event_id);
CREATE INDEX IF NOT EXISTS idx_ec_approvals_user_id ON ec_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_ec_approvals_approved ON ec_approvals(approved) WHERE approved = true;

ALTER TABLE ec_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view approvals" ON ec_approvals;
DROP POLICY IF EXISTS "EC members can insert their own approvals" ON ec_approvals;
DROP POLICY IF EXISTS "EC members can update their own approvals" ON ec_approvals;
DROP POLICY IF EXISTS "Admins can manage all approvals" ON ec_approvals;

CREATE POLICY "Everyone can view approvals" ON ec_approvals FOR SELECT USING (true);
CREATE POLICY "EC members can insert their own approvals" ON ec_approvals FOR INSERT
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL));
CREATE POLICY "EC members can update their own approvals" ON ec_approvals FOR UPDATE
USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL));
CREATE POLICY "Admins can manage all approvals" ON ec_approvals FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'super_admin' OR profiles.is_admin = true)));

DO $ BEGIN RAISE NOTICE '✅ STEP 3 COMPLETE: EC approvals table created'; END $;

-- ============================================
-- STEP 4: CREATE WORKFLOW_CONFIG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflow_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view workflow config" ON workflow_config;
DROP POLICY IF EXISTS "Only admins can modify workflow config" ON workflow_config;

CREATE POLICY "Anyone can view workflow config" ON workflow_config FOR SELECT USING (true);
CREATE POLICY "Only admins can modify workflow config" ON workflow_config FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'super_admin' OR profiles.is_admin = true)));

-- Insert default values
INSERT INTO workflow_config (key, value, description)
VALUES 
  ('head_approvals_required', '1', 'Number of head approvals required (1 or 2)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO workflow_config (key, value, description)
VALUES 
  ('ec_approval_mode', '"any_one"', 'EC approval mode: any_one, one_from_each_tier, or all_four')
ON CONFLICT (key) DO NOTHING;

INSERT INTO workflow_config (key, value, description)
VALUES 
  ('ec_approval_count', '2', 'Number of EC approvals required when mode is any_one')
ON CONFLICT (key) DO NOTHING;

INSERT INTO workflow_config (key, value, description)
VALUES 
  ('event_visibility', '"after_active"', 'When events become visible to other committees: once_proposed, after_head_approval, or after_active')
ON CONFLICT (key) DO NOTHING;

DO $ BEGIN RAISE NOTICE '✅ STEP 4 COMPLETE: Workflow config table created'; END $;

-- ============================================
-- STEP 5: CREATE NOTIFICATIONS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete their own notifications" ON notifications FOR DELETE USING (user_id = auth.uid());

-- Notification trigger functions
CREATE OR REPLACE FUNCTION notify_committee_heads_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT 
    cm.user_id, 'proposal', 'New Event Proposal',
    'New event "' || NEW.title || '" has been proposed for your committee',
    '/dashboard/proposals'
  FROM committee_members cm
  WHERE cm.committee_id = NEW.committee_id
    AND cm.position IN ('head', 'co_head')
    AND cm.user_id != NEW.proposed_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_ec_on_head_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending_ec_approval' AND OLD.status != 'pending_ec_approval' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      p.id, 'approval', 'Event Ready for EC Approval',
      'Event "' || NEW.title || '" has been approved by committee head and needs EC approval',
      '/dashboard/proposals'
    FROM profiles p
    WHERE p.executive_role IS NOT NULL AND p.id != NEW.head_approved_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_proposer_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    IF NEW.status = 'active' THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (NEW.proposed_by, 'approval', 'Event Approved!',
        'Your event "' || NEW.title || '" has been approved and is now active',
        '/dashboard/events/progress');
    ELSIF NEW.status = 'rejected_by_head' THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (NEW.proposed_by, 'rejection', 'Event Rejected by Committee Head',
        'Your event "' || NEW.title || '" was rejected by the committee head',
        '/dashboard/proposals');
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (NEW.proposed_by, 'rejection', 'Event Cancelled',
        'Your event "' || NEW.title || '" has been cancelled',
        '/dashboard/proposals');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_on_ec_revoke()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending_ec_approval' AND OLD.status = 'rejected_by_head' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.proposed_by, 'approval', 'Rejection Revoked by EC',
      'The EC has revoked the rejection of your event "' || NEW.title || '" and it is now under EC review',
      '/dashboard/proposals');
    IF NEW.head_approved_by IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (NEW.head_approved_by, 'approval', 'EC Revoked Your Rejection',
        'The EC has revoked your rejection of event "' || NEW.title || '"',
        '/dashboard/proposals');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_heads_on_proposal ON events;
DROP TRIGGER IF EXISTS trigger_notify_ec_on_head_approval ON events;
DROP TRIGGER IF EXISTS trigger_notify_proposer_on_status_change ON events;
DROP TRIGGER IF EXISTS trigger_notify_on_ec_revoke ON events;

CREATE TRIGGER trigger_notify_heads_on_proposal
AFTER INSERT ON events FOR EACH ROW
WHEN (NEW.status = 'pending_head_approval')
EXECUTE FUNCTION notify_committee_heads_on_proposal();

CREATE TRIGGER trigger_notify_ec_on_head_approval
AFTER UPDATE ON events FOR EACH ROW
EXECUTE FUNCTION notify_ec_on_head_approval();

CREATE TRIGGER trigger_notify_proposer_on_status_change
AFTER UPDATE ON events FOR EACH ROW
EXECUTE FUNCTION notify_proposer_on_status_change();

CREATE TRIGGER trigger_notify_on_ec_revoke
AFTER UPDATE ON events FOR EACH ROW
EXECUTE FUNCTION notify_on_ec_revoke();

DO $ BEGIN RAISE NOTICE '✅ STEP 5 COMPLETE: Notifications system created'; END $;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  enum_count INTEGER;
  column_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPLETE DATABASE SETUP FINISHED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Check enum values
  SELECT COUNT(*) INTO enum_count
  FROM pg_enum 
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
    AND enumlabel IN ('pending_ec_approval', 'rejected_by_head', 'active');
  
  RAISE NOTICE 'Enum Values: % of 3 added', enum_count;
  
  -- Check columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'events'
    AND column_name IN ('rejection_reason', 'head_rejection_reason', 'edit_history');
  
  RAISE NOTICE 'Event Columns: % of 3 verified', column_count;
  
  -- Check tables
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ec_approvals') INTO table_exists;
  RAISE NOTICE 'EC Approvals Table: %', CASE WHEN table_exists THEN '✅ Exists' ELSE '❌ Missing' END;
  
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_config') INTO table_exists;
  RAISE NOTICE 'Workflow Config Table: %', CASE WHEN table_exists THEN '✅ Exists' ELSE '❌ Missing' END;
  
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') INTO table_exists;
  RAISE NOTICE 'Notifications Table: %', CASE WHEN table_exists THEN '✅ Exists' ELSE '❌ Missing' END;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Restart your Next.js dev server';
  RAISE NOTICE '2. Open dashboard to see notification bell';
  RAISE NOTICE '3. Test by proposing an event';
  RAISE NOTICE '========================================';
END $$;
