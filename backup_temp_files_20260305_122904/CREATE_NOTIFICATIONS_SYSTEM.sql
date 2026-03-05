-- ============================================
-- CREATE NOTIFICATIONS SYSTEM
-- Complete notification system for dashboard
-- ============================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'proposal', 'approval', 'rejection', 'chat', 'task', 'meeting'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- URL to navigate to when clicked
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Add comments
COMMENT ON TABLE notifications IS 'User notifications for dashboard alerts';
COMMENT ON COLUMN notifications.user_id IS 'User who receives the notification';
COMMENT ON COLUMN notifications.type IS 'Type of notification: proposal, approval, rejection, chat, task, meeting';
COMMENT ON COLUMN notifications.title IS 'Short notification title';
COMMENT ON COLUMN notifications.message IS 'Detailed notification message';
COMMENT ON COLUMN notifications.link IS 'URL to navigate to when notification is clicked';
COMMENT ON COLUMN notifications.read IS 'Whether user has read the notification';

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- RLS Policies

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid());

-- System can insert notifications (authenticated users can create)
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
USING (user_id = auth.uid());

-- ============================================
-- NOTIFICATION TRIGGER FUNCTIONS
-- ============================================

-- Function to notify committee heads when event is proposed
CREATE OR REPLACE FUNCTION notify_committee_heads_on_proposal()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify committee head(s) when a new event is proposed
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT 
    cm.user_id,
    'proposal',
    'New Event Proposal',
    'New event "' || NEW.title || '" has been proposed for your committee',
    '/dashboard/proposals'
  FROM committee_members cm
  WHERE cm.committee_id = NEW.committee_id
    AND cm.position IN ('head', 'co_head')
    AND cm.user_id != NEW.proposed_by; -- Don't notify the proposer
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to notify EC when event reaches EC approval stage
CREATE OR REPLACE FUNCTION notify_ec_on_head_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify all EC members when event reaches EC approval stage
  IF NEW.status = 'pending_ec_approval' AND OLD.status != 'pending_ec_approval' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      p.id,
      'approval',
      'Event Ready for EC Approval',
      'Event "' || NEW.title || '" has been approved by committee head and needs EC approval',
      '/dashboard/proposals'
    FROM profiles p
    WHERE p.executive_role IS NOT NULL
      AND p.id != NEW.head_approved_by; -- Don't notify the approver
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to notify proposer when event is approved/rejected
CREATE OR REPLACE FUNCTION notify_proposer_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify proposer when event status changes
  IF NEW.status != OLD.status THEN
    IF NEW.status = 'active' THEN
      -- Event approved and active
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        NEW.proposed_by,
        'approval',
        'Event Approved!',
        'Your event "' || NEW.title || '" has been approved and is now active',
        '/dashboard/events/progress'
      );
    ELSIF NEW.status = 'rejected_by_head' THEN
      -- Event rejected by head
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        NEW.proposed_by,
        'rejection',
        'Event Rejected by Committee Head',
        'Your event "' || NEW.title || '" was rejected by the committee head',
        '/dashboard/proposals'
      );
    ELSIF NEW.status = 'cancelled' THEN
      -- Event cancelled
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        NEW.proposed_by,
        'rejection',
        'Event Cancelled',
        'Your event "' || NEW.title || '" has been cancelled',
        '/dashboard/proposals'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to notify when EC revokes head rejection
CREATE OR REPLACE FUNCTION notify_on_ec_revoke()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify when EC revokes a head rejection
  IF NEW.status = 'pending_ec_approval' AND OLD.status = 'rejected_by_head' THEN
    -- Notify proposer
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.proposed_by,
      'approval',
      'Rejection Revoked by EC',
      'The EC has revoked the rejection of your event "' || NEW.title || '" and it is now under EC review',
      '/dashboard/proposals'
    );
    
    -- Notify committee head
    IF NEW.head_approved_by IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        NEW.head_approved_by,
        'approval',
        'EC Revoked Your Rejection',
        'The EC has revoked your rejection of event "' || NEW.title || '"',
        '/dashboard/proposals'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS trigger_notify_heads_on_proposal ON events;
DROP TRIGGER IF EXISTS trigger_notify_ec_on_head_approval ON events;
DROP TRIGGER IF EXISTS trigger_notify_proposer_on_status_change ON events;
DROP TRIGGER IF EXISTS trigger_notify_on_ec_revoke ON events;

-- Trigger when event is proposed
CREATE TRIGGER trigger_notify_heads_on_proposal
AFTER INSERT ON events
FOR EACH ROW
WHEN (NEW.status = 'pending_head_approval')
EXECUTE FUNCTION notify_committee_heads_on_proposal();

-- Trigger when event reaches EC approval
CREATE TRIGGER trigger_notify_ec_on_head_approval
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION notify_ec_on_head_approval();

-- Trigger when event status changes (approval/rejection)
CREATE TRIGGER trigger_notify_proposer_on_status_change
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION notify_proposer_on_status_change();

-- Trigger when EC revokes head rejection
CREATE TRIGGER trigger_notify_on_ec_revoke
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION notify_on_ec_revoke();

-- ============================================
-- HELPER FUNCTION: Mark all as read
-- ============================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET read = true, updated_at = NOW()
  WHERE user_id = p_user_id AND read = false;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Delete old notifications
-- ============================================

CREATE OR REPLACE FUNCTION delete_old_notifications(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
    AND read = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ NOTIFICATIONS SYSTEM CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '✅ Notifications table with RLS policies';
  RAISE NOTICE '✅ Auto-notify on event proposal';
  RAISE NOTICE '✅ Auto-notify on head approval';
  RAISE NOTICE '✅ Auto-notify on EC approval/rejection';
  RAISE NOTICE '✅ Auto-notify on EC revoke';
  RAISE NOTICE '✅ Mark as read functionality';
  RAISE NOTICE '✅ Auto-cleanup of old notifications';
  RAISE NOTICE '';
  RAISE NOTICE 'Notification Types:';
  RAISE NOTICE '• proposal - New event proposed';
  RAISE NOTICE '• approval - Event approved';
  RAISE NOTICE '• rejection - Event rejected';
  RAISE NOTICE '• chat - New chat message (manual)';
  RAISE NOTICE '• task - Task assigned (manual)';
  RAISE NOTICE '• meeting - Meeting scheduled (manual)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Add NotificationBell component to dashboard';
  RAISE NOTICE '2. Implement real-time subscriptions';
  RAISE NOTICE '3. Add notification preferences';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
