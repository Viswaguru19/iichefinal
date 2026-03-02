-- Task assignment tables
CREATE TABLE IF NOT EXISTS event_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES committees(id),
  task_title TEXT NOT NULL,
  task_description TEXT,
  assigned_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'not_started',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES event_tasks(id) ON DELETE CASCADE,
  update_text TEXT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  venue TEXT,
  participants_count INTEGER,
  highlights TEXT,
  photos_url TEXT,
  document_url TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tasks" ON event_tasks FOR SELECT USING (true);
CREATE POLICY "Executive can assign tasks" ON event_tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND executive_role IS NOT NULL)
);
CREATE POLICY "Committee can update tasks" ON event_tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND committee_id = event_tasks.committee_id)
);

CREATE POLICY "Anyone can view updates" ON task_updates FOR SELECT USING (true);
CREATE POLICY "Committee can post updates" ON task_updates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM event_tasks et
    JOIN committee_members cm ON cm.committee_id = et.committee_id
    WHERE et.id = task_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view reports" ON event_reports FOR SELECT USING (true);
CREATE POLICY "Editorial can upload reports" ON event_reports FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM committee_members cm
    JOIN committees c ON cm.committee_id = c.id
    WHERE cm.user_id = auth.uid() AND c.name = 'Editorial Committee'
  )
);
