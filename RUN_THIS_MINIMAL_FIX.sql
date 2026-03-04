-- ============================================
-- MINIMAL FIX: Only Events and Form Fields
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

-- Success message
SELECT '✅ Events and Form Fields RLS policies updated!' as status;

-- Show recent events
SELECT 
  e.id,
  e.title,
  c.name as committee,
  e.status,
  p.name as proposed_by,
  e.created_at
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles p ON e.proposed_by = p.id
ORDER BY e.created_at DESC
LIMIT 5;
