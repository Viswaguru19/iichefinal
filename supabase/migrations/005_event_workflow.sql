-- Event workflow tracking
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
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event tasks/checklist
CREATE TABLE event_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predefined task templates
INSERT INTO event_tasks (event_proposal_id, task_name) VALUES
(NULL, 'Get permission from Student Welfare'),
(NULL, 'Contact Resource Person'),
(NULL, 'Book Hall'),
(NULL, 'Design Poster'),
(NULL, 'Circulate Poster'),
(NULL, 'Create Registration Form'),
(NULL, 'Circulate Registration Form');

-- Event registrations
CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  registration_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Committee chat
CREATE TABLE committee_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID REFERENCES committees(id),
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  google_meet_link TEXT,
  agenda TEXT,
  minutes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting attendance
CREATE TABLE meeting_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'invited',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance tracking
CREATE TABLE finance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id),
  committee_id UUID REFERENCES committees(id),
  type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  description TEXT,
  receipt_url TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE event_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Event proposals viewable by all" ON event_proposals FOR SELECT USING (true);
CREATE POLICY "Committee members can create proposals" ON event_proposals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
);

CREATE POLICY "Tasks viewable by all" ON event_tasks FOR SELECT USING (true);
CREATE POLICY "Committee members can view messages" ON committee_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND committee_id = committee_messages.committee_id)
);
CREATE POLICY "Committee members can send messages" ON committee_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND committee_id = committee_messages.committee_id)
);

CREATE POLICY "Meetings viewable by committee members" ON meetings FOR SELECT USING (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND committee_id = meetings.committee_id)
);

CREATE POLICY "Finance records viewable by authorized users" ON finance_records FOR SELECT USING (true);
CREATE POLICY "Committee members can create finance records" ON finance_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
);
