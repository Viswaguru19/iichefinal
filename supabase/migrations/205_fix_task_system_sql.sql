-- ============================================
-- TASK MANAGEMENT SYSTEM - FIXED VERSION
-- Run this instead of CREATE_TASK_MANAGEMENT_SYSTEM.sql
-- ============================================

-- ============================================
-- STEP 1: ADD EVENT STATUS ENUM VALUES
-- ============================================

-- Add in_progress status
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'in_progress';

-- Add completed status
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'completed';

-- ============================================
-- STEP 2: ADD EVENT POSTER COLUMNS
-- ============================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS poster_url TEXT,
ADD COLUMN IF NOT EXISTS poster_uploaded_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS poster_uploaded_at TIMESTAMPTZ;

-- ============================================
-- STEP 3: CREATE TASK_ASSIGNMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_committee UUID NOT NULL REFERENCES committees(id),
  assigned_by_committee UUID NOT NULL REFERENCES committees(id),
  assigned_by_user UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_ec_approval' CHECK (status IN ('pending_ec_approval', 'approved', 'in_progress', 'completed', 'rejected')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  ec_approved_by UUID REFERENCES profiles(id),
  ec_approved_at TIMESTAMPTZ,
  ec_rejection_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_assignments_event_id ON task_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to_committee);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by_committee);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status ON task_assignments(status);

-- Enable RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Everyone can view task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Proposing committee can create tasks" ON task_assignments;
DROP POLICY IF EXISTS "Assigned committee can update their tasks" ON task_assignments;
DROP POLICY IF EXISTS "EC can approve/reject tasks" ON task_assignments;
DROP POLICY IF EXISTS "Admins can manage all tasks" ON task_assignments;

CREATE POLICY "Everyone can view task assignments"
ON task_assignments FOR SELECT
USING (true);

CREATE POLICY "Proposing committee can create tasks"
ON task_assignments FOR INSERT
WITH CHECK (
  assigned_by_committee IN (
    SELECT committee_id FROM committee_members 
    WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM events 
    WHERE events.id = event_id 
    AND events.status IN ('active', 'in_progress')
  )
);

CREATE POLICY "Assigned committee can update their tasks"
ON task_assignments FOR UPDATE
USING (
  assigned_to_committee IN (
    SELECT committee_id FROM committee_members 
    WHERE user_id = auth.uid()
  )
  AND status IN ('approved', 'in_progress')
);

CREATE POLICY "EC can approve/reject tasks"
ON task_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.executive_role IS NOT NULL
  )
  AND status = 'pending_ec_approval'
);

CREATE POLICY "Admins can manage all tasks"
ON task_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'super_admin' OR profiles.is_admin = true)
  )
);

-- ============================================
-- STEP 4: CREATE TASK_UPDATES TABLE
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_task_updates_created_at ON task_updates(created_at DESC);

ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view task updates" ON task_updates;
DROP POLICY IF EXISTS "Assigned committee can add updates" ON task_updates;

CREATE POLICY "Everyone can view task updates"
ON task_updates FOR SELECT
USING (true);

CREATE POLICY "Assigned committee can add updates"
ON task_updates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
    WHERE ta.id = task_id
    AND cm.user_id = auth.uid()
  )
);

-- ============================================
-- STEP 5: CREATE TASK_DOCUMENTS TABLE
-- ============================================

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

DROP POLICY IF EXISTS "Everyone can view task documents" ON task_documents;
DROP POLICY IF EXISTS "Assigned committee can upload documents" ON task_documents;
DROP POLICY IF EXISTS "Admins can manage documents" ON task_documents;

CREATE POLICY "Everyone can view task documents"
ON task_documents FOR SELECT
USING (true);

CREATE POLICY "Assigned committee can upload documents"
ON task_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
    WHERE ta.id = task_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage documents"
ON task_documents FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'super_admin' OR profiles.is_admin = true)
  )
);

-- ============================================
-- STEP 6: NOTIFICATION TRIGGERS FOR TASKS
-- ============================================

-- Notify when task is assigned (pending EC approval)
CREATE OR REPLACE FUNCTION notify_on_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT 
    p.id,
    'task',
    'New Task Assignment Pending Approval',
    'Task "' || NEW.title || '" needs EC approval for assignment',
    '/dashboard/tasks'
  FROM profiles p
  WHERE p.executive_role IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notify when EC approves task
CREATE OR REPLACE FUNCTION notify_on_task_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending_ec_approval' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'task',
      'New Task Assigned to Your Committee',
      'Task "' || NEW.title || '" has been assigned to your committee',
      '/dashboard/tasks'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.assigned_to_committee;
    
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assigned_by_user,
      'approval',
      'Task Assignment Approved',
      'Your task "' || NEW.title || '" has been approved by EC',
      '/dashboard/tasks'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notify when task is completed
CREATE OR REPLACE FUNCTION notify_on_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'task',
      'Task Completed',
      'Task "' || NEW.title || '" has been marked as completed',
      '/dashboard/tasks'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.assigned_by_committee;
    
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      p.id,
      'task',
      'Task Completed',
      'Task "' || NEW.title || '" has been completed',
      '/dashboard/tasks'
    FROM profiles p
    WHERE p.executive_role IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notify when event becomes active (proposal accepted)
CREATE OR REPLACE FUNCTION notify_on_event_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'approval',
      'Proposal Accepted! Assign Tasks',
      'Your event "' || NEW.title || '" is approved. You can now assign tasks to committees.',
      '/dashboard/events/progress'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.committee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_on_task_assignment ON task_assignments;
DROP TRIGGER IF EXISTS trigger_notify_on_task_approval ON task_assignments;
DROP TRIGGER IF EXISTS trigger_notify_on_task_completion ON task_assignments;
DROP TRIGGER IF EXISTS trigger_notify_on_event_active ON events;

CREATE TRIGGER trigger_notify_on_task_assignment
AFTER INSERT ON task_assignments
FOR EACH ROW
WHEN (NEW.status = 'pending_ec_approval')
EXECUTE FUNCTION notify_on_task_assignment();

CREATE TRIGGER trigger_notify_on_task_approval
AFTER UPDATE ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_on_task_approval();

CREATE TRIGGER trigger_notify_on_task_completion
AFTER UPDATE ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_on_task_completion();

CREATE TRIGGER trigger_notify_on_event_active
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION notify_on_event_active();

-- ============================================
-- CREATE STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for event-posters
DROP POLICY IF EXISTS "Anyone can view event posters" ON storage.objects;
DROP POLICY IF EXISTS "Graphics committee can upload posters" ON storage.objects;

CREATE POLICY "Anyone can view event posters"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-posters');

CREATE POLICY "Graphics committee can upload posters"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-posters'
  AND auth.uid() IN (
    SELECT cm.user_id
    FROM committee_members cm
    JOIN committees c ON c.id = cm.committee_id
    WHERE c.name = 'Graphics Committee'
  )
);

-- Storage RLS policies for event-documents
DROP POLICY IF EXISTS "Anyone can view event documents" ON storage.objects;
DROP POLICY IF EXISTS "Committee members can upload documents" ON storage.objects;

CREATE POLICY "Anyone can view event documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-documents');

CREATE POLICY "Committee members can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-documents'
  AND auth.uid() IN (
    SELECT user_id FROM committee_members
  )
);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'Task Management System Created Successfully!' as message,
       'Tables: task_assignments, task_updates, task_documents' as tables_created,
       'Triggers: 4 notification triggers added' as triggers_created,
       'Storage: event-posters, event-documents buckets created' as storage_created;
