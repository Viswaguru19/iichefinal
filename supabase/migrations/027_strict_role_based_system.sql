-- ============================================
-- STRICT ROLE-BASED MANAGEMENT SYSTEM
-- IIChE Student Chapter - AVV Coimbatore
-- ============================================

-- Drop old role enum and create new one with all roles
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM (
  'admin',
  'faculty_advisor',
  'secretary',
  'joint_secretary',
  'associate_secretary',
  'associate_joint_secretary',
  'treasurer',
  'associate_treasurer',
  'committee_head',
  'committee_cohead',
  'committee_member'
);

-- Create executive_role enum for EC members
CREATE TYPE executive_role AS ENUM (
  'secretary',
  'joint_secretary',
  'associate_secretary',
  'associate_joint_secretary',
  'treasurer',
  'associate_treasurer'
);

-- Update profiles table to support new role system
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS role CASCADE,
  ADD COLUMN role user_role DEFAULT 'committee_member',
  ADD COLUMN executive_role executive_role,
  ADD COLUMN is_faculty BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN phone TEXT,
  ADD COLUMN department TEXT,
  ADD COLUMN year INTEGER;

-- ============================================
-- APPROVAL LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS approval_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_role user_role,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'event', 'task', 'poster', 'email', 'kickoff', 'finance'
  entity_id UUID,
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_logs_entity ON approval_logs(entity_type, entity_id);
CREATE INDEX idx_approval_logs_user ON approval_logs(user_id);
CREATE INDEX idx_approval_logs_created ON approval_logs(created_at DESC);

-- ============================================
-- ENHANCED TASK SYSTEM
-- ============================================

-- Task status enum
CREATE TYPE task_status AS ENUM (
  'draft',
  'pending_ec_approval',
  'ec_approved',
  'ec_rejected',
  'not_started',
  'in_progress',
  'partially_completed',
  'completed'
);

-- Task priority enum
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Tasks table with EC approval workflow
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  proposed_by_committee_id UUID REFERENCES committees(id),
  assigned_to_committee_id UUID REFERENCES committees(id),
  created_by UUID REFERENCES profiles(id),
  status task_status DEFAULT 'draft',
  priority task_priority DEFAULT 'medium',
  deadline TIMESTAMPTZ,
  ec_approved_by UUID REFERENCES profiles(id),
  ec_approved_at TIMESTAMPTZ,
  ec_rejection_reason TEXT,
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_event ON tasks(event_id);
CREATE INDEX idx_tasks_proposed_by ON tasks(proposed_by_committee_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_committee_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Task updates/comments
CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  update_text TEXT NOT NULL,
  status_change task_status,
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_updates_task ON task_updates(task_id);

-- ============================================
-- CENTRAL DOCUMENTS SYSTEM
-- ============================================

CREATE TYPE document_type AS ENUM (
  'task_document',
  'event_document',
  'poster',
  'email_draft',
  'meeting_minutes',
  'finance_document',
  'general'
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  document_type document_type NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  committee_id UUID REFERENCES committees(id),
  event_id UUID REFERENCES events(id),
  task_id UUID REFERENCES tasks(id),
  year INTEGER,
  month INTEGER,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_committee ON documents(committee_id);
CREATE INDEX idx_documents_event ON documents(event_id);
CREATE INDEX idx_documents_task ON documents(task_id);
CREATE INDEX idx_documents_year_month ON documents(year, month);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);

-- ============================================
-- PR & GRAPHICS APPROVAL WORKFLOW
-- ============================================

CREATE TYPE approval_status AS ENUM (
  'draft',
  'pending_faculty',
  'faculty_approved',
  'faculty_rejected',
  'published'
);

-- PR Emails table
CREATE TABLE IF NOT EXISTS pr_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipients TEXT[],
  drafted_by UUID REFERENCES profiles(id),
  status approval_status DEFAULT 'draft',
  faculty_approved_by UUID REFERENCES profiles(id),
  faculty_approved_at TIMESTAMPTZ,
  faculty_rejection_reason TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pr_emails_event ON pr_emails(event_id);
CREATE INDEX idx_pr_emails_status ON pr_emails(status);

-- Posters table with approval
CREATE TABLE IF NOT EXISTS posters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  poster_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  status approval_status DEFAULT 'draft',
  faculty_approved_by UUID REFERENCES profiles(id),
  faculty_approved_at TIMESTAMPTZ,
  faculty_rejection_reason TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posters_event ON posters(event_id);
CREATE INDEX idx_posters_status ON posters(status);

-- ============================================
-- KICKOFF CONTROL SYSTEM
-- ============================================

-- Kickoff configuration
CREATE TABLE IF NOT EXISTS kickoff_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_enabled BOOLEAN DEFAULT FALSE,
  registration_link TEXT,
  current_tournament_id UUID,
  controlled_by_committee_id UUID REFERENCES committees(id),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add approval fields to kickoff_teams
ALTER TABLE kickoff_teams
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Kickoff schedule
CREATE TABLE IF NOT EXISTS kickoff_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID,
  schedule_data JSONB NOT NULL,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  visible_to_students BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENHANCED CHAT SYSTEM
-- ============================================

CREATE TYPE chat_type AS ENUM (
  'personal',
  'committee',
  'organization',
  'executive',
  'coheads',
  'custom_group'
);

-- Chat groups
CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  chat_type chat_type NOT NULL,
  committee_id UUID REFERENCES committees(id),
  created_by UUID REFERENCES profiles(id),
  avatar_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_groups_type ON chat_groups(chat_type);
CREATE INDEX idx_chat_groups_committee ON chat_groups(committee_id);

-- Chat participants
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_chat_participants_group ON chat_participants(group_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT,
  file_url TEXT,
  file_type TEXT,
  reply_to UUID REFERENCES chat_messages(id),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_group ON chat_messages(group_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);

-- Message read status
CREATE TABLE IF NOT EXISTS message_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_read_status_message ON message_read_status(message_id);

-- Typing indicators (temporary, can use Supabase Realtime)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================
-- ENHANCED MEETING SYSTEM
-- ============================================

CREATE TYPE meeting_type AS ENUM ('online', 'offline');
CREATE TYPE meeting_platform AS ENUM ('microsoft_teams', 'google_meet', 'zoom', 'other');

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_type meeting_type NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  duration INTEGER, -- in minutes
  location TEXT, -- for offline meetings
  platform meeting_platform, -- for online meetings
  meeting_link TEXT,
  created_by UUID REFERENCES profiles(id),
  committee_id UUID REFERENCES committees(id),
  participants UUID[], -- array of user IDs
  agenda TEXT,
  minutes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_committee ON meetings(committee_id);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);

-- Meeting participants tracking
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  attended BOOLEAN DEFAULT FALSE,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user ON meeting_participants(user_id);

-- ============================================
-- ENHANCED EVENT SYSTEM
-- ============================================

CREATE TYPE event_status AS ENUM (
  'draft',
  'pending_head_approval',
  'pending_faculty_approval',
  'faculty_approved',
  'active',
  'completed',
  'cancelled'
);

-- Add new fields to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status event_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS head_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS head_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faculty_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS faculty_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS finance_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_approved_by UUID REFERENCES profiles(id);

-- ============================================
-- FINANCE SYSTEM
-- ============================================

CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'budget_allocation');
CREATE TYPE finance_approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id),
  committee_id UUID REFERENCES committees(id),
  transaction_type transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  submitted_by UUID REFERENCES profiles(id),
  approval_status finance_approval_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_finance_transactions_event ON finance_transactions(event_id);
CREATE INDEX idx_finance_transactions_committee ON finance_transactions(committee_id);
CREATE INDEX idx_finance_transactions_status ON finance_transactions(approval_status);

-- ============================================
-- FORMS SYSTEM FIX
-- ============================================

-- Ensure forms table exists with proper structure
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id),
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  responses JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_responses_form ON form_responses(form_id);
CREATE INDEX idx_form_responses_user ON form_responses(user_id);

-- ============================================
-- ENABLE RLS ON ALL NEW TABLES
-- ============================================

ALTER TABLE approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE posters ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pr_emails_updated_at BEFORE UPDATE ON pr_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posters_updated_at BEFORE UPDATE ON posters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user is EC member
CREATE OR REPLACE FUNCTION is_ec_member(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND executive_role IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is faculty
CREATE OR REPLACE FUNCTION is_faculty(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND is_faculty = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log approval action
CREATE OR REPLACE FUNCTION log_approval(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_role user_role;
  v_log_id UUID;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  
  INSERT INTO approval_logs (
    user_id, user_role, action, entity_type, entity_id,
    previous_status, new_status, reason, metadata
  ) VALUES (
    p_user_id, v_user_role, p_action, p_entity_type, p_entity_id,
    p_previous_status, p_new_status, p_reason, p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON MIGRATION IS 'Strict role-based management system for IIChE Student Chapter';
