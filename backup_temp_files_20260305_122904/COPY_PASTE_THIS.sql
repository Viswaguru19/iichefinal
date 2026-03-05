-- ============================================
-- COPY AND PASTE THIS ENTIRE FILE
-- Run in Supabase SQL Editor
-- ============================================

-- Part 1: Create tables
CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_committee UUID NOT NULL REFERENCES committees(id),
  assigned_by_committee UUID NOT NULL REFERENCES committees(id),
  assigned_by_user UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_ec_approval',
  progress INTEGER DEFAULT 0,
  ec_approved_by UUID,
  ec_approved_at TIMESTAMPTZ,
  ec_rejection_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  update_text TEXT NOT NULL,
  progress_before INTEGER,
  progress_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Part 2: Enable RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;

-- Part 3: Simple policies (everyone can do everything for now)
DROP POLICY IF EXISTS "task_assignments_policy" ON task_assignments;
CREATE POLICY "task_assignments_policy" ON task_assignments USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "task_updates_policy" ON task_updates;
CREATE POLICY "task_updates_policy" ON task_updates USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "task_documents_policy" ON task_documents;
CREATE POLICY "task_documents_policy" ON task_documents USING (true) WITH CHECK (true);

-- Part 4: Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Done!
SELECT 'SUCCESS! Task system created. Now restart your dev server.' as message;
