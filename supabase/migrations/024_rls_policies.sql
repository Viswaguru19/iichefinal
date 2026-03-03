-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- Strict Role-Based Access Control
-- ============================================

-- ============================================
-- PROFILES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Profiles viewable by authenticated users"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- TASKS POLICIES
-- ============================================

-- Anyone in a committee can view tasks assigned to their committee
CREATE POLICY "Committee members can view their tasks"
  ON tasks FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = tasks.assigned_to_committee_id
    )
    OR auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = tasks.proposed_by_committee_id
    )
    OR is_ec_member(auth.uid())
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

-- Committee heads/coheads can create tasks
CREATE POLICY "Committee heads can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT cm.user_id FROM committee_members cm
      JOIN profiles p ON cm.user_id = p.id
      WHERE cm.committee_id = tasks.proposed_by_committee_id
      AND cm.position IN ('head', 'co_head')
    )
  );

-- Assigned committee can update task status
CREATE POLICY "Assigned committee can update tasks"
  ON tasks FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = tasks.assigned_to_committee_id
    )
  );

-- EC members can approve/reject tasks
CREATE POLICY "EC members can approve tasks"
  ON tasks FOR UPDATE
  USING (is_ec_member(auth.uid()))
  WITH CHECK (is_ec_member(auth.uid()));

-- ============================================
-- TASK UPDATES POLICIES
-- ============================================

CREATE POLICY "Committee members can view task updates"
  ON task_updates FOR SELECT
  USING (
    auth.uid() IN (
      SELECT cm.user_id FROM committee_members cm
      JOIN tasks t ON t.assigned_to_committee_id = cm.committee_id
      WHERE t.id = task_updates.task_id
    )
    OR is_ec_member(auth.uid())
    OR is_faculty(auth.uid())
  );

CREATE POLICY "Committee members can add task updates"
  ON task_updates FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT cm.user_id FROM committee_members cm
      JOIN tasks t ON t.assigned_to_committee_id = cm.committee_id
      WHERE t.id = task_updates.task_id
    )
  );

-- ============================================
-- DOCUMENTS POLICIES
-- ============================================

CREATE POLICY "Documents viewable by committee members"
  ON documents FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = documents.committee_id
    )
    OR is_ec_member(auth.uid())
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Committee members can upload documents"
  ON documents FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = documents.committee_id
    )
  );

CREATE POLICY "Uploaders can delete their documents"
  ON documents FOR DELETE
  USING (auth.uid() = uploaded_by OR is_admin(auth.uid()));

-- ============================================
-- PR EMAILS POLICIES
-- ============================================

CREATE POLICY "PR emails viewable by PR committee and faculty"
  ON pr_emails FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      WHERE c.name = 'PR Committee'
    )
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "PR committee can create emails"
  ON pr_emails FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      WHERE c.name = 'PR Committee'
    )
  );

CREATE POLICY "PR committee can update draft emails"
  ON pr_emails FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      WHERE c.name = 'PR Committee'
    )
    AND status = 'draft'
  );

CREATE POLICY "Faculty can approve PR emails"
  ON pr_emails FOR UPDATE
  USING (is_faculty(auth.uid()))
  WITH CHECK (is_faculty(auth.uid()));

-- ============================================
-- POSTERS POLICIES
-- ============================================

CREATE POLICY "Posters viewable by graphics committee and faculty"
  ON posters FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      WHERE c.name = 'Graphics Committee' OR c.name = 'Design Committee'
    )
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
    OR status = 'published' -- Published posters visible to all
  );

CREATE POLICY "Graphics committee can upload posters"
  ON posters FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      WHERE c.name = 'Graphics Committee' OR c.name = 'Design Committee'
    )
  );

CREATE POLICY "Faculty can approve posters"
  ON posters FOR UPDATE
  USING (is_faculty(auth.uid()))
  WITH CHECK (is_faculty(auth.uid()));

-- ============================================
-- KICKOFF CONFIG POLICIES
-- ============================================

CREATE POLICY "Kickoff config viewable by all"
  ON kickoff_config FOR SELECT
  USING (true);

CREATE POLICY "Environmental committee can update kickoff config"
  ON kickoff_config FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      WHERE c.name = 'Environmental Committee' OR c.name = 'Social Committee'
      AND cm.position IN ('head', 'co_head')
    )
    OR is_admin(auth.uid())
  );

-- ============================================
-- KICKOFF TEAMS POLICIES
-- ============================================

CREATE POLICY "Kickoff teams viewable by all authenticated"
  ON kickoff_teams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Students can register teams"
  ON kickoff_teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Environmental committee can approve teams"
  ON kickoff_teams FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      WHERE c.name = 'Environmental Committee' OR c.name = 'Social Committee'
    )
    OR is_admin(auth.uid())
  );

-- ============================================
-- CHAT GROUPS POLICIES
-- ============================================

CREATE POLICY "Users can view groups they're part of"
  ON chat_groups FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM chat_participants 
      WHERE group_id = chat_groups.id
    )
    OR is_admin(auth.uid())
  );

CREATE POLICY "Users can create custom groups"
  ON chat_groups FOR INSERT
  WITH CHECK (
    auth.uid() = created_by 
    AND chat_type = 'custom_group'
  );

CREATE POLICY "Admins can create any group"
  ON chat_groups FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- CHAT PARTICIPANTS POLICIES
-- ============================================

CREATE POLICY "Users can view participants of their groups"
  ON chat_participants FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM chat_participants cp2
      WHERE cp2.group_id = chat_participants.group_id
    )
  );

CREATE POLICY "Group admins can add participants"
  ON chat_participants FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM chat_participants 
      WHERE group_id = chat_participants.group_id 
      AND is_admin = true
    )
    OR is_admin(auth.uid())
  );

CREATE POLICY "Users can leave groups"
  ON chat_participants FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- CHAT MESSAGES POLICIES
-- ============================================

CREATE POLICY "Users can view messages in their groups"
  ON chat_messages FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM chat_participants 
      WHERE group_id = chat_messages.group_id
    )
  );

CREATE POLICY "Participants can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM chat_participants 
      WHERE group_id = chat_messages.group_id
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- MEETINGS POLICIES
-- ============================================

CREATE POLICY "Users can view meetings they're invited to"
  ON meetings FOR SELECT
  USING (
    auth.uid() = ANY(participants)
    OR auth.uid() = created_by
    OR is_ec_member(auth.uid())
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Committee heads can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE position IN ('head', 'co_head')
    )
    OR is_ec_member(auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Meeting creators can update meetings"
  ON meetings FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

-- ============================================
-- EVENTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Events viewable by everyone" ON events;
DROP POLICY IF EXISTS "Committee members can create events" ON events;

CREATE POLICY "Active events viewable by all"
  ON events FOR SELECT
  USING (
    status = 'active' 
    OR status = 'completed'
    OR auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = events.committee_id
    )
    OR is_ec_member(auth.uid())
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Committee coheads can propose events"
  ON events FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = events.committee_id
      AND position = 'co_head'
    )
  );

CREATE POLICY "Committee heads can approve events"
  ON events FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = events.committee_id
      AND position = 'head'
    )
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

-- ============================================
-- FINANCE TRANSACTIONS POLICIES
-- ============================================

CREATE POLICY "Finance transactions viewable by committee and EC"
  ON finance_transactions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = finance_transactions.committee_id
    )
    OR is_ec_member(auth.uid())
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Committee members can submit transactions"
  ON finance_transactions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE committee_id = finance_transactions.committee_id
    )
  );

CREATE POLICY "Treasurer can approve transactions"
  ON finance_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND executive_role IN ('treasurer', 'associate_treasurer')
    )
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

-- ============================================
-- FORMS POLICIES
-- ============================================

CREATE POLICY "Active forms viewable by all"
  ON forms FOR SELECT
  USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Committee heads can create forms"
  ON forms FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM committee_members 
      WHERE position IN ('head', 'co_head')
    )
    OR is_admin(auth.uid())
  );

CREATE POLICY "Form responses viewable by form creator and admins"
  ON form_responses FOR SELECT
  USING (
    auth.uid() IN (
      SELECT created_by FROM forms WHERE id = form_responses.form_id
    )
    OR auth.uid() = user_id
    OR is_admin(auth.uid())
  );

CREATE POLICY "Anyone can submit form responses"
  ON form_responses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- APPROVAL LOGS POLICIES
-- ============================================

CREATE POLICY "Approval logs viewable by EC, faculty, and admins"
  ON approval_logs FOR SELECT
  USING (
    is_ec_member(auth.uid())
    OR is_faculty(auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "System can insert approval logs"
  ON approval_logs FOR INSERT
  WITH CHECK (true); -- Controlled by functions

COMMENT ON MIGRATION IS 'Comprehensive RLS policies for strict role-based access control';
