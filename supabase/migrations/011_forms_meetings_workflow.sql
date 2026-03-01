-- Forms System
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  committee_id UUID REFERENCES committees(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL, -- text, email, number, dropdown, checkbox, radio, textarea, date
  label TEXT NOT NULL,
  options TEXT[], -- for dropdown, checkbox, radio
  required BOOLEAN DEFAULT false,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  responses JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings System
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL, -- online, offline
  meeting_date TIMESTAMPTZ NOT NULL,
  duration INTEGER, -- minutes
  location TEXT, -- for offline
  meeting_link TEXT, -- for online
  created_by UUID REFERENCES profiles(id),
  invite_type TEXT NOT NULL, -- specific_committee, all_committees, executive_only
  committee_id UUID REFERENCES committees(id), -- if specific_committee
  status TEXT DEFAULT 'scheduled', -- scheduled, ongoing, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending', -- pending, accepted, declined
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'absent', -- present, absent
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated Event Workflow
CREATE TABLE IF NOT EXISTS event_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES profiles(id),
  approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposal_id, approver_id)
);

CREATE TABLE IF NOT EXISTS event_committee_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES committees(id),
  task_title TEXT NOT NULL,
  task_description TEXT,
  assigned_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_daily_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES event_committee_tasks(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES committees(id),
  update_text TEXT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  report_content TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_committee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_daily_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;

-- Forms policies
CREATE POLICY "Anyone can view active forms" ON forms FOR SELECT USING (is_active = true);
CREATE POLICY "Committee members can create forms" ON forms FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Anyone can view form fields" ON form_fields FOR SELECT USING (true);
CREATE POLICY "Anyone can submit form responses" ON form_responses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Form creator can view responses" ON form_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM forms WHERE forms.id = form_id AND forms.created_by = auth.uid())
);

-- Meetings policies
CREATE POLICY "Anyone can view meetings" ON meetings FOR SELECT USING (true);
CREATE POLICY "Anyone can create meetings" ON meetings FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Anyone can view invites" ON meeting_invites FOR SELECT USING (true);
CREATE POLICY "Users can respond to invites" ON meeting_invites FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Anyone can view attendance" ON meeting_attendance FOR SELECT USING (true);
CREATE POLICY "Meeting creator can mark attendance" ON meeting_attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_id AND meetings.created_by = auth.uid())
);
CREATE POLICY "Anyone can view meeting minutes" ON meeting_minutes FOR SELECT USING (true);
CREATE POLICY "Editorial can upload minutes" ON meeting_minutes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM committee_members cm
    JOIN committees c ON cm.committee_id = c.id
    WHERE cm.user_id = auth.uid() AND c.name = 'Editorial Committee'
  )
);

-- Event workflow policies
CREATE POLICY "Anyone can view approvals" ON event_approvals FOR SELECT USING (true);
CREATE POLICY "Executive can approve" ON event_approvals FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
    AND profiles.executive_role NOT IN ('treasurer', 'associate_treasurer')
  )
);
CREATE POLICY "Anyone can view tasks" ON event_committee_tasks FOR SELECT USING (true);
CREATE POLICY "Executive can assign tasks" ON event_committee_tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
);
CREATE POLICY "Anyone can view updates" ON event_daily_updates FOR SELECT USING (true);
CREATE POLICY "Committee members can post updates" ON event_daily_updates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND committee_id = event_daily_updates.committee_id)
);
CREATE POLICY "Anyone can view reports" ON event_reports FOR SELECT USING (true);
CREATE POLICY "Editorial can upload reports" ON event_reports FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM committee_members cm
    JOIN committees c ON cm.committee_id = c.id
    WHERE cm.user_id = auth.uid() AND c.name = 'Editorial Committee'
  )
);

-- Function to check if all executive members approved
CREATE OR REPLACE FUNCTION check_all_executive_approved(p_proposal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_executive INTEGER;
  total_approved INTEGER;
BEGIN
  -- Count executive members (excluding treasurer roles)
  SELECT COUNT(*) INTO total_executive
  FROM profiles
  WHERE executive_role IS NOT NULL
  AND executive_role NOT IN ('treasurer', 'associate_treasurer');
  
  -- Count approved
  SELECT COUNT(*) INTO total_approved
  FROM event_approvals
  WHERE proposal_id = p_proposal_id AND approved = true;
  
  RETURN total_approved >= total_executive;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate event progress
CREATE OR REPLACE FUNCTION calculate_event_progress(p_proposal_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_tasks INTEGER;
  completed_tasks INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tasks
  FROM event_committee_tasks
  WHERE proposal_id = p_proposal_id;
  
  IF total_tasks = 0 THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*) INTO completed_tasks
  FROM event_committee_tasks
  WHERE proposal_id = p_proposal_id AND status = 'completed';
  
  RETURN (completed_tasks * 100 / total_tasks);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
