-- ============================================
-- FIX: Committee Tools Visibility for Heads & Co-Heads
-- ============================================
-- This ensures heads and co-heads can access all committee tools:
-- Forms, Meetings, Events, Tasks, Documents, etc.

-- ============================================
-- 1. EVENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Committee members can view events" ON events;
DROP POLICY IF EXISTS "Users can view events" ON events;
DROP POLICY IF EXISTS "Users can view events based on role" ON events;

CREATE POLICY "Users can view events based on role" ON events
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_faculty = true)
  OR EXISTS (SELECT 1 FROM committee_members cm WHERE cm.user_id = auth.uid() AND cm.committee_id = events.committee_id)
  OR events.proposed_by = auth.uid()
);

-- ============================================
-- 2. FORMS TABLE
-- ============================================
DROP POLICY IF EXISTS "Anyone can view active forms" ON forms;
DROP POLICY IF EXISTS "Committee members can view forms" ON forms;

CREATE POLICY "Users can view forms" ON forms
FOR SELECT
USING (
  forms.is_active = true
  AND (
    forms.committee_id IS NULL  -- Public forms
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
    OR EXISTS (SELECT 1 FROM committee_members cm WHERE cm.user_id = auth.uid() AND cm.committee_id = forms.committee_id)
    OR forms.created_by = auth.uid()
  )
);

-- ============================================
-- 3. FORM RESPONSES TABLE
-- ============================================
DROP POLICY IF EXISTS "Form creator can view responses" ON form_responses;
DROP POLICY IF EXISTS "Heads can view responses" ON form_responses;

CREATE POLICY "Users can view form responses" ON form_responses
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_responses.form_id
    AND f.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM forms f
    JOIN committee_members cm ON cm.committee_id = f.committee_id
    WHERE f.id = form_responses.form_id
    AND cm.user_id = auth.uid()
    AND cm.position IN ('head', 'co_head')
  )
  OR form_responses.user_id = auth.uid()
);

-- ============================================
-- 4. MEETINGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Anyone can view meetings" ON meetings;
DROP POLICY IF EXISTS "Committee members can view meetings" ON meetings;

CREATE POLICY "Users can view meetings" ON meetings
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR meetings.invite_type = 'all_committees'
  OR meetings.invite_type = 'executive_only' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR (meetings.invite_type = 'specific_committee' AND EXISTS (
    SELECT 1 FROM committee_members cm 
    WHERE cm.user_id = auth.uid() 
    AND cm.committee_id = meetings.committee_id
  ))
  OR meetings.created_by = auth.uid()
);

-- ============================================
-- 5. MEETING INVITES TABLE
-- ============================================
DROP POLICY IF EXISTS "Anyone can view invites" ON meeting_invites;
DROP POLICY IF EXISTS "Users can view invites" ON meeting_invites;

CREATE POLICY "Users can view meeting invites" ON meeting_invites
FOR SELECT
USING (
  meeting_invites.user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_invites.meeting_id
    AND m.created_by = auth.uid()
  )
);

-- ============================================
-- 6. MEETING MINUTES TABLE
-- ============================================
DROP POLICY IF EXISTS "Anyone can view meeting minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Users can view meeting minutes" ON meeting_minutes;

CREATE POLICY "Users can view meeting minutes" ON meeting_minutes
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM meetings m
    JOIN meeting_invites mi ON mi.meeting_id = m.id
    WHERE m.id = meeting_minutes.meeting_id
    AND mi.user_id = auth.uid()
  )
);

-- ============================================
-- 7. DOCUMENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Anyone can view documents" ON documents;
DROP POLICY IF EXISTS "Committee members can view documents" ON documents;

CREATE POLICY "Users can view documents" ON documents
FOR SELECT
USING (
  documents.is_public = true
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM committee_members cm 
    WHERE cm.user_id = auth.uid() 
    AND cm.committee_id = documents.committee_id
  )
  OR documents.uploaded_by = auth.uid()
);

-- ============================================
-- 8. TASKS TABLE (event_committee_tasks)
-- ============================================
DROP POLICY IF EXISTS "Anyone can view tasks" ON event_committee_tasks;
DROP POLICY IF EXISTS "Committee members can view tasks" ON event_committee_tasks;

CREATE POLICY "Users can view tasks" ON event_committee_tasks
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM committee_members cm 
    WHERE cm.user_id = auth.uid() 
    AND cm.committee_id = event_committee_tasks.committee_id
  )
);

-- ============================================
-- 9. CHAT GROUPS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view their chat groups" ON chat_groups;

CREATE POLICY "Users can view their chat groups" ON chat_groups
FOR SELECT
USING (
  chat_groups.type = 'system'
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM committee_members cm 
    WHERE cm.user_id = auth.uid() 
    AND cm.committee_id = chat_groups.committee_id
  )
);

-- ============================================
-- 10. CHAT MESSAGES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view messages in their groups" ON chat_messages;

CREATE POLICY "Users can view messages in their groups" ON chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_groups cg
    WHERE cg.id = chat_messages.group_id
    AND (
      cg.type = 'system'
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.executive_role IS NOT NULL)
      OR EXISTS (
        SELECT 1 FROM committee_members cm 
        WHERE cm.user_id = auth.uid() 
        AND cm.committee_id = cg.committee_id
      )
    )
  )
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all RLS policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN (
  'events', 'forms', 'form_responses', 'meetings', 
  'meeting_invites', 'meeting_minutes', 'documents',
  'event_committee_tasks', 'chat_groups', 'chat_messages'
)
ORDER BY tablename, policyname;

-- Check committee heads and their access
SELECT 
  p.name as head_name,
  p.email,
  c.name as committee_name,
  cm.position,
  'Should see all committee tools' as access_level
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name, cm.position;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT '✅ All RLS policies updated! Heads and co-heads can now access all committee tools.' as status;
