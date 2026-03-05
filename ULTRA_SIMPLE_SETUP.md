# 🚀 Ultra Simple Task System Setup

## The Problem
SQL syntax errors with `IF NOT EXISTS` and `DO $` blocks.

## The Solution
Run commands ONE AT A TIME, copy-paste each block separately.

---

## ✅ STEP 1: Tables Only (No Policies Yet)

Copy this ENTIRE block and run:

```sql
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_uploaded_by UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_uploaded_at TIMESTAMPTZ;

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

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true)
ON CONFLICT (id) DO NOTHING;
```

---

## ✅ STEP 2: Add Policies

Copy this ENTIRE block and run:

```sql
CREATE POLICY "view_task_assignments" ON task_assignments FOR SELECT USING (true);
CREATE POLICY "create_task_assignments" ON task_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "update_task_assignments" ON task_assignments FOR UPDATE USING (true);

CREATE POLICY "view_task_updates" ON task_updates FOR SELECT USING (true);
CREATE POLICY "create_task_updates" ON task_updates FOR INSERT WITH CHECK (true);

CREATE POLICY "view_task_documents" ON task_documents FOR SELECT USING (true);
CREATE POLICY "create_task_documents" ON task_documents FOR INSERT WITH CHECK (true);
```

---

## ✅ STEP 3: Add Notification Triggers

Copy and run the file: `ADD_TASK_NOTIFICATIONS.sql`

---

## ✅ STEP 4: Restart Server

```bash
npm run dev
```

---

## ✅ STEP 5: Test

1. Go to `/dashboard/tasks`
2. You should see the task management page
3. Try assigning a task!

---

## 🎉 Done!

The system is now ready with:
- ✅ Task assignment
- ✅ Progress tracking
- ✅ Document uploads
- ✅ Notifications

---

## If Errors Occur:

### "already exists"
- That's OK! It means it was already created
- Continue to next step

### "does not exist"
- Go back and run previous step again
- Make sure it completed successfully

### "syntax error"
- Copy the EXACT block again
- Make sure you copied everything
- Try running in smaller pieces

---

## Verify Success:

```sql
SELECT COUNT(*) FROM task_assignments;
```

If this returns a number (even 0), it worked! 🎉
