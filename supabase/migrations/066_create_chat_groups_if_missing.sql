-- Ensure chat_groups and chat_participants tables exist
CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  chat_type TEXT NOT NULL DEFAULT 'custom_group',
  committee_id UUID REFERENCES committees(id),
  created_by UUID REFERENCES profiles(id),
  avatar_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Anyone can view chat groups" ON chat_groups;
CREATE POLICY "Anyone can view chat groups" ON chat_groups FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can create groups" ON chat_groups;
CREATE POLICY "Authenticated users can create groups" ON chat_groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view participants" ON chat_participants;
CREATE POLICY "Anyone can view participants" ON chat_participants FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can add participants" ON chat_participants;
CREATE POLICY "Authenticated users can add participants" ON chat_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_chat_groups_type ON chat_groups(chat_type);
CREATE INDEX IF NOT EXISTS idx_chat_participants_group ON chat_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
