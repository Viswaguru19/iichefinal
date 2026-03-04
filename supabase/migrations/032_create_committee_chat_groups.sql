-- Migration: Create Committee Chat Groups
-- Description: Auto-generate chat groups for all committees and manage membership
-- Phase 1, Task 1.7

-- Create function to create chat group for new committee
CREATE OR REPLACE FUNCTION create_committee_chat_group()
RETURNS TRIGGER AS $$
BEGIN
  -- Create chat group for the committee
  INSERT INTO chat_groups (id, name, chat_type, committee_id, description, created_at)
  VALUES (
    gen_random_uuid(),
    NEW.name || ' Committee',
    'committee',
    NEW.id,
    'Chat group for ' || NEW.name || ' committee members',
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create chat group for new committees
DROP TRIGGER IF EXISTS trigger_create_committee_chat ON committees;
CREATE TRIGGER trigger_create_committee_chat
AFTER INSERT ON committees
FOR EACH ROW
EXECUTE FUNCTION create_committee_chat_group();

-- Create chat groups for existing committees
INSERT INTO chat_groups (id, name, chat_type, committee_id, description, created_at)
SELECT 
  gen_random_uuid(),
  c.name || ' Committee',
  'committee',
  c.id,
  'Chat group for ' || c.name || ' committee members',
  NOW()
FROM committees c
WHERE NOT EXISTS (
  SELECT 1 FROM chat_groups cg
  WHERE cg.committee_id = c.id
  AND cg.chat_type = 'committee'
);

-- Create function to manage committee chat membership
CREATE OR REPLACE FUNCTION manage_committee_chat_membership()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Get the committee's chat group ID
  SELECT id INTO v_group_id
  FROM chat_groups
  WHERE committee_id = COALESCE(NEW.committee_id, OLD.committee_id)
  AND chat_type = 'committee'
  LIMIT 1;
  
  IF v_group_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    -- Add new committee member to chat group
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES (v_group_id, NEW.user_id, NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Remove member from chat group if not in committee anymore
    IF NOT EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = OLD.user_id
      AND committee_id = OLD.committee_id
      AND id != OLD.id
    ) THEN
      DELETE FROM chat_participants
      WHERE group_id = v_group_id
      AND user_id = OLD.user_id;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.committee_id != OLD.committee_id THEN
    -- Member moved to different committee
    -- Remove from old committee chat
    DELETE FROM chat_participants
    WHERE group_id = (
      SELECT id FROM chat_groups
      WHERE committee_id = OLD.committee_id
      AND chat_type = 'committee'
      LIMIT 1
    )
    AND user_id = NEW.user_id;
    
    -- Add to new committee chat
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES (v_group_id, NEW.user_id, NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for committee membership changes
DROP TRIGGER IF EXISTS trigger_manage_committee_chat ON committee_members;
CREATE TRIGGER trigger_manage_committee_chat
AFTER INSERT OR UPDATE OR DELETE ON committee_members
FOR EACH ROW
EXECUTE FUNCTION manage_committee_chat_membership();

-- Add existing committee members to their committee chat groups
INSERT INTO chat_participants (group_id, user_id, joined_at)
SELECT DISTINCT
  cg.id,
  cm.user_id,
  NOW()
FROM committee_members cm
JOIN chat_groups cg ON cg.committee_id = cm.committee_id
WHERE cg.chat_type = 'committee'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Add index for faster committee chat lookups
CREATE INDEX IF NOT EXISTS idx_chat_groups_committee_id 
ON chat_groups(committee_id) 
WHERE chat_type = 'committee';
