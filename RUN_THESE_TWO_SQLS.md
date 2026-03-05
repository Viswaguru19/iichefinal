# Fix All Errors - Run These 2 SQLs

## Step 1: Fix Critical Issues (Forms, Meetings, Notifications, Events)

Run this in Supabase Dashboard → SQL Editor:

```sql
-- Fix critical issues: forms, meetings, notifications, events RLS

-- 1. FIX FORM_FIELDS RLS
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Form creators can insert fields" ON form_fields;
DROP POLICY IF EXISTS "Anyone can view form fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can update fields" ON form_fields;
DROP POLICY IF EXISTS "Form creators can delete fields" ON form_fields;

CREATE POLICY "Form creators can insert fields" ON form_fields FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM forms WHERE forms.id = form_fields.form_id AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))));

CREATE POLICY "Anyone can view form fields" ON form_fields FOR SELECT
  USING (EXISTS (SELECT 1 FROM forms WHERE forms.id = form_fields.form_id AND (forms.active = true OR forms.created_by = auth.uid() OR is_admin(auth.uid()))));

CREATE POLICY "Form creators can update fields" ON form_fields FOR UPDATE
  USING (EXISTS (SELECT 1 FROM forms WHERE forms.id = form_fields.form_id AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))));

CREATE POLICY "Form creators can delete fields" ON form_fields FOR DELETE
  USING (EXISTS (SELECT 1 FROM forms WHERE forms.id = form_fields.form_id AND (forms.created_by = auth.uid() OR is_admin(auth.uid()))));

-- 2. FIX MEETINGS - ADD MISSING COLUMN
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'meeting_type') THEN
    ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'general';
  END IF;
END $$;

-- 3. FIX NOTIFICATIONS RLS
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. FIX EVENTS RLS
DROP POLICY IF EXISTS "Users can view events" ON events;
DROP POLICY IF EXISTS "Anyone can view active events" ON events;
DROP POLICY IF EXISTS "Committee members can view their events" ON events;

CREATE POLICY "Users can view events" ON events FOR SELECT
  USING (
    status IN ('active', 'approved', 'completed')
    OR committee_id IN (SELECT committee_id FROM committee_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE executive_role IS NOT NULL)
    OR is_admin(auth.uid())
  );
```

## Step 2: Create Tasks Table

Run this in Supabase Dashboard → SQL Editor:

```sql
-- Create tasks table for event task management

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES committees(id),
  status TEXT DEFAULT 'pending_ec_approval' CHECK (status IN ('pending_ec_approval', 'assigned', 'in_progress', 'completed', 'cancelled')),
  ec_approved BOOLEAN DEFAULT false,
  ec_approved_at TIMESTAMPTZ,
  ec_approved_by UUID REFERENCES profiles(id),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks" ON tasks FOR SELECT
  USING (
    assigned_to IN (SELECT committee_id FROM committee_members WHERE user_id = auth.uid())
    OR auth.uid() IN (SELECT id FROM profiles WHERE executive_role IS NOT NULL)
    OR is_admin(auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "EC can create tasks" ON tasks FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE executive_role IS NOT NULL) OR is_admin(auth.uid()));

CREATE POLICY "EC can update tasks" ON tasks FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE executive_role IS NOT NULL)
    OR is_admin(auth.uid())
    OR assigned_to IN (SELECT committee_id FROM committee_members WHERE user_id = auth.uid())
  );

CREATE POLICY "EC can delete tasks" ON tasks FOR DELETE
  USING (auth.uid() IN (SELECT id FROM profiles WHERE executive_role IS NOT NULL) OR is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
```

## After Running Both
✅ Forms will work
✅ Meetings will work
✅ Notifications will work
✅ Events will show
✅ Tasks will work
