-- Event proposal workflow with approval chain
CREATE TABLE event_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  proposed_by_committee UUID REFERENCES committees(id),
  proposed_by_user UUID REFERENCES profiles(id),
  event_date TIMESTAMPTZ,
  location TEXT,
  budget DECIMAL,
  requires_resource_person BOOLEAN DEFAULT FALSE,
  resource_person_details TEXT,
  requires_hall BOOLEAN DEFAULT TRUE,
  requires_student_welfare BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',
  joint_secretary_approved BOOLEAN DEFAULT FALSE,
  joint_secretary_approved_by UUID REFERENCES profiles(id),
  joint_secretary_approved_at TIMESTAMPTZ,
  secretary_approved BOOLEAN DEFAULT FALSE,
  secretary_approved_by UUID REFERENCES profiles(id),
  secretary_approved_at TIMESTAMPTZ,
  faculty_approved BOOLEAN DEFAULT FALSE,
  faculty_approved_at TIMESTAMPTZ,
  student_welfare_approved BOOLEAN DEFAULT FALSE,
  student_welfare_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event tasks with progress tracking
CREATE TABLE event_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  assigned_to_committee UUID REFERENCES committees(id),
  assigned_to_user UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending',
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance records with approval chain
CREATE TABLE finance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID REFERENCES committees(id),
  event_proposal_id UUID REFERENCES event_proposals(id),
  type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  description TEXT,
  receipt_url TEXT,
  submitted_by UUID REFERENCES profiles(id),
  treasurer_approved BOOLEAN DEFAULT FALSE,
  treasurer_approved_by UUID REFERENCES profiles(id),
  treasurer_approved_at TIMESTAMPTZ,
  secretary_approved BOOLEAN DEFAULT FALSE,
  secretary_approved_by UUID REFERENCES profiles(id),
  secretary_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Committee work updates
CREATE TABLE committee_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID REFERENCES committees(id),
  event_proposal_id UUID REFERENCES event_proposals(id),
  update_text TEXT NOT NULL,
  posted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE event_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view proposals" ON event_proposals FOR SELECT USING (true);
CREATE POLICY "Committee members can create proposals" ON event_proposals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
);
CREATE POLICY "Executives can update proposals" ON event_proposals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (executive_role IS NOT NULL OR role IN ('super_admin', 'committee_head')))
);

CREATE POLICY "Everyone can view tasks" ON event_tasks FOR SELECT USING (true);
CREATE POLICY "Committee members can update tasks" ON event_tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
);

CREATE POLICY "Everyone can view finance" ON finance_records FOR SELECT USING (true);
CREATE POLICY "Committee members can submit finance" ON finance_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
);
CREATE POLICY "Treasurer and Secretary can approve finance" ON finance_records FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND executive_role IN ('treasurer', 'associate_treasurer', 'secretary', 'associate_secretary'))
);

CREATE POLICY "Everyone can view updates" ON committee_updates FOR SELECT USING (true);
CREATE POLICY "Committee members can post updates" ON committee_updates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
);

-- Function to calculate proposal progress
CREATE OR REPLACE FUNCTION get_proposal_progress(proposal_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_steps INTEGER := 0;
  completed_steps INTEGER := 0;
  proposal RECORD;
BEGIN
  SELECT * INTO proposal FROM event_proposals WHERE id = proposal_id;
  
  -- Count required steps
  total_steps := 2; -- Joint Secretary + Secretary always required
  
  IF proposal.requires_student_welfare THEN
    total_steps := total_steps + 1;
  END IF;
  
  IF proposal.requires_hall THEN
    total_steps := total_steps + 1;
  END IF;
  
  IF proposal.requires_resource_person THEN
    total_steps := total_steps + 1;
  END IF;
  
  -- Count completed steps
  IF proposal.joint_secretary_approved THEN
    completed_steps := completed_steps + 1;
  END IF;
  
  IF proposal.secretary_approved THEN
    completed_steps := completed_steps + 1;
  END IF;
  
  IF proposal.student_welfare_approved OR NOT proposal.requires_student_welfare THEN
    completed_steps := completed_steps + 1;
  END IF;
  
  -- Check tasks
  IF EXISTS (SELECT 1 FROM event_tasks WHERE event_proposal_id = proposal_id AND task_type = 'hall_booking' AND status = 'completed') OR NOT proposal.requires_hall THEN
    completed_steps := completed_steps + 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM event_tasks WHERE event_proposal_id = proposal_id AND task_type = 'resource_person' AND status = 'completed') OR NOT proposal.requires_resource_person THEN
    completed_steps := completed_steps + 1;
  END IF;
  
  RETURN (completed_steps * 100 / total_steps);
END;
$$ LANGUAGE plpgsql;
