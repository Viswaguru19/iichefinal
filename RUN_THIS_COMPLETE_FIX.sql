-- ============================================
-- COMPLETE FIX: All Issues (CORRECTED)
-- ============================================

-- FIX 1: Events table RLS (for proposal visibility)
DROP POLICY IF EXISTS "Users can view events based on role" ON events;
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Committee members can view events" ON events;
DROP POLICY IF EXISTS "Users can view events" ON events;

CREATE POLICY "Users can view events" ON events
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_faculty = true)
  OR EXISTS (SELECT 1 FROM committee_members cm WHERE cm.user_id = auth.uid() AND cm.committee_id = events.committee_id)
  OR events.proposed_by = auth.uid()
);

-- FIX 2: Form fields RLS (for forms to work)
DROP POLICY IF EXISTS "Form creator can insert fields" ON form_fields;
DROP POLICY IF EXISTS "Form creator can update fields" ON form_fields;
DROP POLICY IF EXISTS "Form creator can delete fields" ON form_fields;

CREATE POLICY "Form creator can insert fields" ON form_fields 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM forms WHERE forms.id = form_id AND forms.created_by = auth.uid())
);

CREATE POLICY "Form creator can update fields" ON form_fields 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM forms WHERE forms.id = form_id AND forms.created_by = auth.uid())
);

CREATE POLICY "Form creator can delete fields" ON form_fields 
FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM forms WHERE forms.id = form_id AND forms.created_by = auth.uid())
);

-- FIX 3: Forms table RLS (for committee tools) - CORRECTED COLUMN NAME
DROP POLICY IF EXISTS "Anyone can view active forms" ON forms;
DROP POLICY IF EXISTS "Committee members can view forms" ON forms;
DROP POLICY IF EXISTS "Users can view forms" ON forms;

CREATE POLICY "Users can view forms" ON forms
FOR SELECT
USING (
  -- Check if forms table has is_active or active column
  (
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'forms' AND column_name = 'is_active'
      ) THEN (forms.is_active = true)
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'forms' AND column_name = 'active'
      ) THEN (forms.active = true)
      ELSE true
    END
  )
  AND (
    forms.committee_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
    OR EXISTS (SELECT 1 FROM committee_members cm WHERE cm.user_id = auth.uid() AND cm.committee_id = forms.committee_id)
    OR forms.created_by = auth.uid()
  )
);

-- FIX 4: Meetings table RLS (for committee tools)
DROP POLICY IF EXISTS "Anyone can view meetings" ON meetings;
DROP POLICY IF EXISTS "Committee members can view meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings" ON meetings;

CREATE POLICY "Users can view meetings" ON meetings
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR meetings.invite_type = 'all_committees'
  OR (meetings.invite_type = 'executive_only' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL))
  OR (meetings.invite_type = 'specific_committee' AND EXISTS (SELECT 1 FROM committee_members cm WHERE cm.user_id = auth.uid() AND cm.committee_id = meetings.committee_id))
  OR meetings.created_by = auth.uid()
);

-- Verification
SELECT '✅ All RLS policies updated successfully!' as status;

-- Show forms table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'forms'
ORDER BY ordinal_position;

-- Show current events
SELECT 
  e.id,
  e.title,
  c.name as committee,
  e.status,
  p.name as proposed_by
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles p ON e.proposed_by = p.id
ORDER BY e.created_at DESC
LIMIT 5;
