-- Fix critical issues: forms, meetings, notifications, events RLS
-- (Skipping tasks table as it doesn't exist yet)

-- ============================================
-- 1. FIX FORM_FIELDS RLS
-- ============================================

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

-- ============================================
-- 2. FIX MEETINGS - ADD MISSING COLUMN
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'meeting_type') THEN
    ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'general';
  END IF;
END $$;

-- ============================================
-- 3. FIX NOTIFICATIONS RLS
-- ============================================

DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 4. FIX EVENTS RLS
-- ============================================

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
