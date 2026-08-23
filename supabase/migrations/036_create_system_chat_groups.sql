-- Migration: Create System Chat Groups
-- Description: Create organization-wide, EC, heads, and co-heads chat groups
-- Phase 1, Task 1.6

-- Insert system chat groups (idempotent)
INSERT INTO chat_groups (id, name, chat_type, description, created_at)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    'Whole Organization',
    'organization',
    'Chat group for all members of IIChE Student Chapter',
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'EC Board',
    'executive',
    'Executive Committee members only',
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'All Committee Heads',
    'heads',
    'All committee heads',
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'All Committee Co-Heads',
    'coheads',
    'All committee co-heads',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Add constraint to prevent deletion of system groups
ALTER TABLE chat_groups
ADD CONSTRAINT prevent_system_group_deletion
CHECK (
  chat_type NOT IN ('organization', 'executive', 'heads', 'coheads')
  OR id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004'
  )
);

-- Create function to auto-add users to organization group
CREATE OR REPLACE FUNCTION add_user_to_organization_group()
RETURNS TRIGGER AS $$
BEGIN
  -- Add new user to organization group
  INSERT INTO chat_participants (group_id, user_id, joined_at)
  VALUES ('00000000-0000-0000-0000-000000000001', NEW.id, NOW())
  ON CONFLICT (group_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-add users to organization group
DROP TRIGGER IF EXISTS trigger_add_user_to_org_group ON profiles;
CREATE TRIGGER trigger_add_user_to_org_group
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION add_user_to_organization_group();

-- Add existing users to organization group
INSERT INTO chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000001', id, NOW()
FROM profiles
WHERE is_active = true
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Create function to manage EC group membership
CREATE OR REPLACE FUNCTION manage_ec_group_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.executive_role IS NOT NULL AND (OLD.executive_role IS NULL OR OLD IS NULL) THEN
    -- User became EC member, add to EC group
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000002', NEW.id, NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  ELSIF NEW.executive_role IS NULL AND OLD.executive_role IS NOT NULL THEN
    -- User is no longer EC member, remove from EC group
    DELETE FROM chat_participants
    WHERE group_id = '00000000-0000-0000-0000-000000000002'
    AND user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for EC group membership
DROP TRIGGER IF EXISTS trigger_manage_ec_group ON profiles;
CREATE TRIGGER trigger_manage_ec_group
AFTER INSERT OR UPDATE OF executive_role ON profiles
FOR EACH ROW
EXECUTE FUNCTION manage_ec_group_membership();

-- Add existing EC members to EC group
INSERT INTO chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000002', id, NOW()
FROM profiles
WHERE executive_role IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Create function to manage heads group membership
CREATE OR REPLACE FUNCTION manage_heads_group_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.position = 'head' AND (OLD.position IS NULL OR OLD.position != 'head' OR OLD IS NULL) THEN
    -- User became head, add to heads group
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000003', NEW.user_id, NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  ELSIF OLD.position = 'head' AND (NEW.position IS NULL OR NEW.position != 'head') THEN
    -- User is no longer head, remove from heads group if not head elsewhere
    IF NOT EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = NEW.user_id
      AND position = 'head'
      AND id != NEW.id
    ) THEN
      DELETE FROM chat_participants
      WHERE group_id = '00000000-0000-0000-0000-000000000003'
      AND user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for heads group membership
DROP TRIGGER IF EXISTS trigger_manage_heads_group ON committee_members;
CREATE TRIGGER trigger_manage_heads_group
AFTER INSERT OR UPDATE OF position ON committee_members
FOR EACH ROW
EXECUTE FUNCTION manage_heads_group_membership();

-- Add existing heads to heads group
INSERT INTO chat_participants (group_id, user_id, joined_at)
SELECT DISTINCT '00000000-0000-0000-0000-000000000003', user_id, NOW()
FROM committee_members
WHERE position = 'head'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Create function to manage co-heads group membership
CREATE OR REPLACE FUNCTION manage_coheads_group_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.position = 'co_head' AND (OLD.position IS NULL OR OLD.position != 'co_head' OR OLD IS NULL) THEN
    -- User became co-head, add to co-heads group
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000004', NEW.user_id, NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  ELSIF OLD.position = 'co_head' AND (NEW.position IS NULL OR NEW.position != 'co_head') THEN
    -- User is no longer co-head, remove from co-heads group if not co-head elsewhere
    IF NOT EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = NEW.user_id
      AND position = 'co_head'
      AND id != NEW.id
    ) THEN
      DELETE FROM chat_participants
      WHERE group_id = '00000000-0000-0000-0000-000000000004'
      AND user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for co-heads group membership
DROP TRIGGER IF EXISTS trigger_manage_coheads_group ON committee_members;
CREATE TRIGGER trigger_manage_coheads_group
AFTER INSERT OR UPDATE OF position ON committee_members
FOR EACH ROW
EXECUTE FUNCTION manage_coheads_group_membership();

-- Add existing co-heads to co-heads group
INSERT INTO chat_participants (group_id, user_id, joined_at)
SELECT DISTINCT '00000000-0000-0000-0000-000000000004', user_id, NOW()
FROM committee_members
WHERE position = 'co_head'
ON CONFLICT (group_id, user_id) DO NOTHING;
