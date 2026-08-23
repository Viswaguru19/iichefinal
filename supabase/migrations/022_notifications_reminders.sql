-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  related_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES profiles(id),
  sent_to UUID REFERENCES profiles(id),
  reminder_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minutes of Meeting table
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date DATE NOT NULL,
  title TEXT NOT NULL,
  purpose TEXT,
  attendees TEXT[],
  document_url TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Reminders policies
CREATE POLICY "Anyone can view reminders" ON reminders FOR SELECT USING (true);
CREATE POLICY "Users can send reminders" ON reminders FOR INSERT WITH CHECK (sent_by = auth.uid());

-- Meeting minutes policies
CREATE POLICY "Anyone can view minutes" ON meeting_minutes FOR SELECT USING (true);
CREATE POLICY "Editorial can upload minutes" ON meeting_minutes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM committee_members cm
    JOIN committees c ON cm.committee_id = c.id
    WHERE cm.user_id = auth.uid() AND c.name = 'Editorial Committee'
  )
);

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_related_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify when proposal status changes
CREATE OR REPLACE FUNCTION notify_proposal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    PERFORM create_notification(
      NEW.proposed_by_user,
      'Proposal Status Updated',
      'Your proposal "' || NEW.title || '" status changed to ' || NEW.status,
      'proposal_update',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposal_status_change ON event_proposals;
CREATE TRIGGER proposal_status_change
  AFTER UPDATE ON event_proposals
  FOR EACH ROW
  EXECUTE FUNCTION notify_proposal_status_change();
