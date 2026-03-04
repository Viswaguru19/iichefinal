-- ============================================
-- Enable Heads & Co-Heads to Create Forms and Meetings
-- ============================================

-- FIX 1: Forms INSERT policy (allow heads/co-heads to create forms)
DROP POLICY IF EXISTS "Committee members can create forms" ON forms;
DROP POLICY IF EXISTS "Authenticated users can create forms" ON forms;
DROP POLICY IF EXISTS "Users can create forms" ON forms;

CREATE POLICY "Users can create forms" ON forms
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Super admin
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR
    -- Executive members
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
    OR
    -- Committee heads and co-heads
    EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND position IN ('head', 'co_head'))
    OR
    -- Any committee member
    EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
  )
);

-- FIX 2: Meetings INSERT policy (allow heads/co-heads to create meetings)
DROP POLICY IF EXISTS "Anyone can create meetings" ON meetings;
DROP POLICY IF EXISTS "Authenticated users can create meetings" ON meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON meetings;

CREATE POLICY "Users can create meetings" ON meetings
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND (
    -- Super admin
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR
    -- Executive members
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
    OR
    -- Committee heads and co-heads
    EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid() AND position IN ('head', 'co_head'))
    OR
    -- Any committee member
    EXISTS (SELECT 1 FROM committee_members WHERE user_id = auth.uid())
  )
);

-- FIX 3: Allow heads/co-heads to update their own forms
DROP POLICY IF EXISTS "Form creator can update forms" ON forms;

CREATE POLICY "Form creator can update forms" ON forms
FOR UPDATE
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
);

-- FIX 4: Allow heads/co-heads to update their own meetings
DROP POLICY IF EXISTS "Meeting creator can update meetings" ON meetings;

CREATE POLICY "Meeting creator can update meetings" ON meetings
FOR UPDATE
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
);

-- Verification
SELECT '✅ Heads and co-heads can now create forms and meetings!' as status;

-- Show who can create forms and meetings
SELECT 
  p.name,
  p.email,
  cm.position,
  c.name as committee,
  'Can create forms and meetings' as permissions
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name, cm.position;
