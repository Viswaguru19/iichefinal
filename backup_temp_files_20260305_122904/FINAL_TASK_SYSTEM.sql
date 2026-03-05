-- ============================================
-- TASK MANAGEMENT SYSTEM - FINAL VERSION
-- This version works with all PostgreSQL versions
-- ============================================

-- Step 1: Add enum values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    RAISE EXCEPTION 'event_status type does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')) THEN
    ALTER TYPE event_status ADD VALUE 'in_progress';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')) THEN
    ALTER TYPE event_status ADD VALUE 'completed';
  END IF;
END $$;

-- Step 2: Add poster columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_uploaded_by UUID REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_uploaded_at TIMESTAMPTZ;

-- Step 3: Create task_assignments table
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
  ec_approved_by UUID REFERENCES profiles(id),
  ec_approved_at TIMESTAMPTZ,
  ec_rejection_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_status CHECK (status IN ('pending_ec_approval', 'approved', 'in_progress', 'completed', 'rejected')),
  CONSTRAINT check_progress CHECK (progress >= 0 AND progress <= 100)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_event_id ON task_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to_committee);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status ON task_assignments(status);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Step 4: Create task_updates table
CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  update_text TEXT NOT NULL,
  progress_before INTEGER,
  progress_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id);
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

-- Step 5: Create task_documents table
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

CREATE INDEX IF NOT EXISTS idx_task_documents_task_id ON task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_event_id ON task_documents(event_id);
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies
DROP POLICY IF EXISTS "Everyone can view task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Committee members can create tasks" ON task_assignments;
DROP POLICY IF EXISTS "Assigned committee can update tasks" ON task_assignments;
DROP POLICY IF EXISTS "Everyone can view task updates" ON task_updates;
DROP POLICY IF EXISTS "Committee members can add updates" ON task_updates;
DROP POLICY IF EXISTS "Everyone can view task documents" ON task_documents;
DROP POLICY IF EXISTS "Committee members can upload documents" ON task_documents;

-- Step 7: Create RLS policies for task_assignments
CREATE POLICY "Everyone can view task assignments"
ON task_assignments FOR SELECT USING (true);

CREATE POLICY "Committee members can create tasks"
ON task_assignments FOR INSERT
WITH CHECK (
  assigned_by_committee IN (
    SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Assigned committee can update tasks"
ON task_assignments FOR UPDATE
USING (
  assigned_to_committee IN (
    SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND executive_role IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  )
);

-- Step 8: Create RLS policies for task_updates
CREATE POLICY "Everyone can view task updates"
ON task_updates FOR SELECT USING (true);

CREATE POLICY "Committee members can add updates"
ON task_updates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
    WHERE ta.id = task_id AND cm.user_id = auth.uid()
  )
);

-- Step 9: Create RLS policies for task_documents
CREATE POLICY "Everyone can view task documents"
ON task_documents FOR SELECT USING (true);

CREATE POLICY "Committee members can upload documents"
ON task_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
    WHERE ta.id = task_id AND cm.user_id = auth.uid()
  )
);

-- Step 10: Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Done!
SELECT 'Task Management System Created Successfully!' as message;
