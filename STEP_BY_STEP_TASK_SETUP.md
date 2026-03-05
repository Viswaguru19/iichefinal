# Step-by-Step Task System Setup

Run these SQL commands ONE AT A TIME in Supabase SQL Editor.

## Part 1: Add Enum Values

```sql
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'in_progress';
```

Click Run. Then run:

```sql
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'completed';
```

## Part 2: Add Event Columns

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_uploaded_by UUID REFERENCES profiles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_uploaded_at TIMESTAMPTZ;
```

## Part 3: Create task_assignments Table

```sql
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

CREATE INDEX idx_task_assignments_event_id ON task_assignments(event_id);
CREATE INDEX idx_task_assignments_assigned_to ON task_assignments(assigned_to_committee);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
```

## Part 4: Create task_updates Table

```sql
CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  update_text TEXT NOT NULL,
  progress_before INTEGER,
  progress_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_updates_task_id ON task_updates(task_id);
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
```

## Part 5: Create task_documents Table

```sql
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

CREATE INDEX idx_task_documents_task_id ON task_documents(task_id);
CREATE INDEX idx_task_documents_event_id ON task_documents(event_id);
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;
```

## Part 6: Add RLS Policies

```sql
-- task_assignments policies
DROP POLICY IF EXISTS "Everyone can view task assignments" ON task_assignments;
CREATE POLICY "Everyone can view task assignments"
ON task_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Committee members can create tasks" ON task_assignments;
CREATE POLICY "Committee members can create tasks"
ON task_assignments FOR INSERT
WITH CHECK (
  assigned_by_committee IN (
    SELECT committee_id FROM committee_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Assigned committee can update tasks" ON task_assignments;
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
```

## Part 7: Add More RLS Policies

```sql
-- task_updates policies
DROP POLICY IF EXISTS "Everyone can view task updates" ON task_updates;
CREATE POLICY "Everyone can view task updates"
ON task_updates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Committee members can add updates" ON task_updates;
CREATE POLICY "Committee members can add updates"
ON task_updates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
    WHERE ta.id = task_id AND cm.user_id = auth.uid()
  )
);

-- task_documents policies
DROP POLICY IF EXISTS "Everyone can view task documents" ON task_documents;
CREATE POLICY "Everyone can view task documents"
ON task_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Committee members can upload documents" ON task_documents;
CREATE POLICY "Committee members can upload documents"
ON task_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN committee_members cm ON cm.committee_id = ta.assigned_to_committee
    WHERE ta.id = task_id AND cm.user_id = auth.uid()
  )
);
```

## Part 8: Create Storage Buckets

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true)
ON CONFLICT (id) DO NOTHING;
```

## Part 9: Add Notification Triggers

Use the file: `ADD_TASK_NOTIFICATIONS.sql`

## Done!

After running all parts:
1. Restart your dev server: `npm run dev`
2. Go to `/dashboard/tasks`
3. Test the system!

## If You Get Errors:

- **"already exists"** - That's OK! Skip to next part
- **"syntax error"** - Copy the exact SQL block again
- **"does not exist"** - Make sure previous parts ran successfully

## Verify It Worked:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('task_assignments', 'task_updates', 'task_documents');

-- Should return 3 rows
```
