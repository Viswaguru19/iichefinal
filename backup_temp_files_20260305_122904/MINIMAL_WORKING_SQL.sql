-- Minimal working SQL - no fancy syntax
-- Copy and paste this entire file

CREATE TABLE task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  title TEXT,
  description TEXT,
  assigned_to_committee UUID REFERENCES committees(id),
  assigned_by_committee UUID REFERENCES committees(id),
  assigned_by_user UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_ec_approval',
  progress INTEGER DEFAULT 0,
  ec_approved_by UUID,
  ec_approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES task_assignments(id),
  user_id UUID REFERENCES profiles(id),
  update_text TEXT,
  progress_before INTEGER,
  progress_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES task_assignments(id),
  event_id UUID REFERENCES events(id),
  file_name TEXT,
  file_url TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p1" ON task_assignments USING (true) WITH CHECK (true);
CREATE POLICY "p2" ON task_updates USING (true) WITH CHECK (true);
CREATE POLICY "p3" ON task_documents USING (true) WITH CHECK (true);

SELECT 'Done!' as status;
