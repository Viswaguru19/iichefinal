-- Migration: Create Base Chat Tables
-- Description: Foundation tables for chat system (must run before enhancement migrations)
-- Run this FIRST before migrations 026-033

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CHAT GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  chat_type TEXT NOT NULL CHECK (chat_type IN ('personal', 'committee', 'organization', 'executive', 'heads', 'coheads', 'custom_group')),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  avatar_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat_groups
CREATE INDEX IF NOT EXISTS idx_chat_groups_type ON chat_groups(chat_type);
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON chat_groups(created_by);

-- ============================================
-- CHAT PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Indexes for chat_participants
CREATE INDEX IF NOT EXISTS idx_chat_participants_group ON chat_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT,
  file_url TEXT,
  file_type TEXT,
  reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- ============================================
-- MESSAGE READ STATUS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS message_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Indexes for message_read_status
CREATE INDEX IF NOT EXISTS idx_message_read_status_message ON message_read_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_user ON message_read_status(user_id);

-- ============================================
-- TYPING INDICATORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Indexes for typing_indicators
CREATE INDEX IF NOT EXISTS idx_typing_indicators_group ON typing_indicators(group_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_updated ON typing_indicators(updated_at DESC);

-- ============================================
-- FUNCTION: Auto-create read status for new messages
-- ============================================
CREATE OR REPLACE FUNCTION create_message_read_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Create read status records for all participants except sender
  INSERT INTO message_read_status (message_id, user_id, created_at)
  SELECT NEW.id, cp.user_id, NOW()
  FROM chat_participants cp
  WHERE cp.group_id = NEW.group_id
  AND cp.user_id != NEW.sender_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create read status
DROP TRIGGER IF EXISTS trigger_create_read_status ON chat_messages;
CREATE TRIGGER trigger_create_read_status
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION create_message_read_status();

-- ============================================
-- FUNCTION: Update message updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on message edit
DROP TRIGGER IF EXISTS trigger_update_message_timestamp ON chat_messages;
CREATE TRIGGER trigger_update_message_timestamp
BEFORE UPDATE ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_message_timestamp();

-- ============================================
-- GRANT PERMISSIONS (RLS will be added in migration 033)
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON message_read_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON typing_indicators TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE chat_groups IS 'Chat groups including personal, committee, and system-wide groups';
COMMENT ON TABLE chat_participants IS 'Users participating in chat groups';
COMMENT ON TABLE chat_messages IS 'Messages sent in chat groups';
COMMENT ON TABLE message_read_status IS 'Tracking which users have read which messages';
COMMENT ON TABLE typing_indicators IS 'Real-time typing indicators for chat groups';
