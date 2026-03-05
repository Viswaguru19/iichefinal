-- ============================================
-- TASK MANAGEMENT & EVENT PROGRESS SYSTEM
-- Complete task assignment, tracking, and poster management
-- ============================================

-- ============================================
-- STEP 1: ADD EVENT STATUS ENUM VALUES
-- ============================================

DO $
BEGIN
  -- Add in_progress status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'in_progress' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'in_progress';
    RAISE NOTICE '✅ Added in_progress enum value';
  ELSE
    RAISE NOTICE '✓ in_progress already exists';
  END IF;

  -- Add completed status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'completed' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'completed';
    RAISE NOTICE '✅ Added completed enum value';
  ELSE
    RAISE NOTICE '✓ completed already exists';
  END IF;
END $;

-- ============================================
-- STEP 2: ADD EVENT POSTER COLUMNS
-- ============================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS poster_url TEXT,
ADD COLUMN IF NOT EXISTS poster_uploaded_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS poster_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN events.poster_url IS 'URL to event poster (uploaded by Graphics committee)';
COMMENT ON COLUMN events.poster_uploaded_by IS 'User who uploaded the poster';
COMMENT ON COLUMN events.poster_uploaded_at IS 'Timestamp when poster was uploaded';

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

-- Add comments
COMMENT ON TABLE task_assignments IS 'Tasks assigned to committees for events';
COMMENT ON COLUMN task_assignments.assigned_to_committee IS 'Committee that needs to complete the task';
COMMENT ON COLUMN task_assignments.assigned_by_committee IS 'Committee that created the task';
COMMENT ON COLUMN task_assignments.progress IS 'Task completion percentage (0-100)';
COMMENT ON COLUMN task_assignments.status IS 'Task status: pending_ec_approval, approved, in_progress, completed, rejected';

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

COMMENT ON TABLE task_updates IS 'Updates and progress logs for tasks';

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

COMMENT ON TABLE task_documents IS 'Documents uploaded for tasks (stored event-wise)';

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
  -- Notify EC members
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
    -- Notify all members of assigned committee
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'task',
      'New Task Assigned to Your Committee',
      'Task "' || NEW.title || '" has been assigned to your committee',
      '/dashboard/tasks'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.assigned_to_committee;
    
    -- Notify assigning committee
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
    -- Notify proposing committee
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'task',
      'Task Completed',
      'Task "' || NEW.title || '" has been marked as completed',
      '/dashboard/tasks'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.assigned_by_committee;
    
    -- Notify EC members
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
    -- Notify proposing committee members
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
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TASK MANAGEMENT SYSTEM CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '✅ task_assignments - Task assignment and tracking';
  RAISE NOTICE '✅ task_updates - Task progress updates';
  RAISE NOTICE '✅ task_documents - Task-related documents';
  RAISE NOTICE '';
  RAISE NOTICE 'Event Columns Added:';
  RAISE NOTICE '✅ poster_url - Event poster URL';
  RAISE NOTICE '✅ poster_uploaded_by - Who uploaded poster';
  RAISE NOTICE '✅ poster_uploaded_at - When poster uploaded';
  RAISE NOTICE '';
  RAISE NOTICE 'Enum Values Added:';
  RAISE NOTICE '✅ in_progress - Event is in progress';
  RAISE NOTICE '✅ completed - Event is completed';
  RAISE NOTICE '';
  RAISE NOTICE 'Notification Triggers:';
  RAISE NOTICE '✅ Task assignment → EC notified';
  RAISE NOTICE '✅ Task approval → Assigned committee notified';
  RAISE NOTICE '✅ Task completion → Proposing committee notified';
  RAISE NOTICE '✅ Event active → Proposing committee notified';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '• Proposing committee can assign tasks';
  RAISE NOTICE '• Tasks need EC approval';
  RAISE NOTICE '• Assigned committee gets notified';
  RAISE NOTICE '• Progress slider (0-100%)';
  RAISE NOTICE '• Task updates and comments';
  RAISE NOTICE '• Document uploads (event-wise)';
  RAISE NOTICE '• Graphics committee poster upload';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
