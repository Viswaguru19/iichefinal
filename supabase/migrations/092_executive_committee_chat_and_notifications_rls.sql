-- Sync EC Board chat (000...002) with Executive Committee membership (committee id 000...001).
-- Tighten notifications UPDATE RLS with WITH CHECK.
-- Extend ensure_default_chat_memberships for EC + backfill.

-- ---------------------------------------------------------------------------
-- Ensure required system chat groups exist (idempotent)
-- ---------------------------------------------------------------------------
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
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Notifications: require updated row to still belong to current user
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
ON notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profile EC trigger: do not remove from EC chat if still on EC committee
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION manage_ec_group_membership()
RETURNS TRIGGER AS $$
DECLARE
  ec_committee UUID := '00000000-0000-0000-0000-000000000001';
  ec_group UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.executive_role IS NOT NULL THEN
      INSERT INTO chat_participants (group_id, user_id, joined_at)
      VALUES (ec_group, NEW.id, NOW())
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.executive_role IS NOT NULL AND (OLD.executive_role IS NULL OR OLD.executive_role IS DISTINCT FROM NEW.executive_role) THEN
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES (ec_group, NEW.id, NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  ELSIF NEW.executive_role IS NULL AND OLD.executive_role IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = NEW.id AND committee_id = ec_committee
    ) THEN
      DELETE FROM chat_participants
      WHERE group_id = ec_group AND user_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Committee membership -> EC Board chat
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_ec_board_chat_from_committee()
RETURNS TRIGGER AS $$
DECLARE
  ec_committee UUID := '00000000-0000-0000-0000-000000000001';
  ec_group UUID := '00000000-0000-0000-0000-000000000002';
  v_user UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.committee_id = ec_committee THEN
      INSERT INTO chat_participants (group_id, user_id, joined_at)
      VALUES (ec_group, NEW.user_id, NOW())
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.committee_id = ec_committee THEN
      v_user := OLD.user_id;
      IF NOT EXISTS (
        SELECT 1 FROM committee_members
        WHERE user_id = v_user AND committee_id = ec_committee
      ) AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = v_user AND executive_role IS NOT NULL
      ) THEN
        DELETE FROM chat_participants
        WHERE group_id = ec_group AND user_id = v_user;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.committee_id = ec_committee AND NEW.committee_id IS DISTINCT FROM ec_committee THEN
    v_user := NEW.user_id;
    IF NOT EXISTS (
      SELECT 1 FROM committee_members
      WHERE user_id = v_user AND committee_id = ec_committee
    ) AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = v_user AND executive_role IS NOT NULL
    ) THEN
      DELETE FROM chat_participants
      WHERE group_id = ec_group AND user_id = v_user;
    END IF;
  END IF;

  IF NEW.committee_id = ec_committee THEN
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES (ec_group, NEW.user_id, NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_ec_board_chat ON committee_members;
CREATE TRIGGER trigger_sync_ec_board_chat
AFTER INSERT OR UPDATE OR DELETE ON committee_members
FOR EACH ROW
EXECUTE FUNCTION sync_ec_board_chat_from_committee();

-- Backfill: everyone on Executive Committee or with executive_role
INSERT INTO chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000002', cm.user_id, NOW()
FROM committee_members cm
WHERE cm.committee_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ensure_default_chat_memberships: org + committee chats + EC Board
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_default_chat_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ec_committee UUID := '00000000-0000-0000-0000-000000000001';
  ec_group UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO chat_participants (group_id, user_id, joined_at)
  VALUES ('00000000-0000-0000-0000-000000000001', auth.uid(), NOW())
  ON CONFLICT (group_id, user_id) DO NOTHING;

  INSERT INTO chat_participants (group_id, user_id, joined_at)
  SELECT cg.id, cm.user_id, NOW()
  FROM committee_members cm
  INNER JOIN chat_groups cg
    ON cg.committee_id = cm.committee_id
   AND cg.chat_type = 'committee'
  WHERE cm.user_id = auth.uid()
  ON CONFLICT (group_id, user_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM committee_members
    WHERE user_id = auth.uid() AND committee_id = ec_committee
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND executive_role IS NOT NULL
  ) THEN
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES (ec_group, auth.uid(), NOW())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_chat_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_chat_memberships() TO authenticated;
