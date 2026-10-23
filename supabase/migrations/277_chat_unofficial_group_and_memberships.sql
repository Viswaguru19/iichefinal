-- Unofficial student group (no faculty) + keep default role/committee chats in sync.

ALTER TABLE public.chat_groups DROP CONSTRAINT IF EXISTS chat_groups_chat_type_check;
ALTER TABLE public.chat_groups
  ADD CONSTRAINT chat_groups_chat_type_check
  CHECK (chat_type IN (
    'personal', 'committee', 'organization', 'executive', 'heads', 'coheads', 'custom_group', 'unofficial'
  ));

INSERT INTO public.chat_groups (id, name, chat_type, description, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000003',
    'Heads',
    'heads',
    'All committee heads',
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Co-heads',
    'coheads',
    'All committee co-heads',
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Unofficial',
    'unofficial',
    'Student chat without faculty',
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    chat_type = EXCLUDED.chat_type;

INSERT INTO public.chat_groups (id, name, chat_type, committee_id, description, created_at)
SELECT gen_random_uuid(),
       CASE WHEN c.name ILIKE '%committee%' THEN c.name ELSE c.name || ' Committee' END,
       'committee',
       c.id,
       'Chat group for ' || c.name || ' members',
       NOW()
FROM public.committees c
WHERE c.id <> '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM public.chat_groups cg
    WHERE cg.committee_id = c.id AND cg.chat_type = 'committee'
  );

UPDATE public.chat_groups
SET name = 'Official',
    description = 'Official IIChE chat including faculty'
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.chat_groups
SET name = 'Office bearers (EC)',
    description = 'Executive Committee / office bearers'
WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE public.chat_groups
SET name = 'Heads',
    description = 'All committee heads'
WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE public.chat_groups
SET name = 'Co-heads',
    description = 'All committee co-heads'
WHERE id = '00000000-0000-0000-0000-000000000004';

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000001', id, NOW()
FROM public.profiles
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000005', id, NOW()
FROM public.profiles
WHERE COALESCE(is_faculty, false) = false
ON CONFLICT (group_id, user_id) DO NOTHING;

DELETE FROM public.chat_participants
WHERE group_id = '00000000-0000-0000-0000-000000000005'
  AND user_id IN (SELECT id FROM public.profiles WHERE COALESCE(is_faculty, false) = true);

CREATE OR REPLACE FUNCTION public.ensure_default_chat_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO chat_participants (group_id, user_id, joined_at)
  VALUES ('00000000-0000-0000-0000-000000000001', uid, now())
  ON CONFLICT (group_id, user_id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = uid AND COALESCE(is_faculty, false) = false) THEN
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000005', uid, now())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = uid AND executive_role IS NOT NULL) THEN
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000002', uid, now())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM committee_members WHERE user_id = uid AND position = 'head') THEN
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000003', uid, now())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM committee_members WHERE user_id = uid AND position = 'co_head') THEN
    INSERT INTO chat_participants (group_id, user_id, joined_at)
    VALUES ('00000000-0000-0000-0000-000000000004', uid, now())
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  INSERT INTO chat_participants (group_id, user_id, joined_at)
  SELECT cg.id, cm.user_id, now()
  FROM committee_members cm
  INNER JOIN chat_groups cg
    ON cg.committee_id = cm.committee_id
   AND cg.chat_type = 'committee'
  WHERE cm.user_id = uid
  ON CONFLICT (group_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_chat_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_chat_memberships() TO authenticated;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000002', id, NOW()
FROM public.profiles
WHERE executive_role IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000003', user_id, NOW()
FROM public.committee_members
WHERE position = 'head'
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000004', user_id, NOW()
FROM public.committee_members
WHERE position = 'co_head'
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT cg.id, cm.user_id, NOW()
FROM public.committee_members cm
INNER JOIN public.chat_groups cg
  ON cg.committee_id = cm.committee_id
 AND cg.chat_type = 'committee'
ON CONFLICT (group_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_send_message_in_group(p_user_id UUID, p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_type TEXT;
  v_is_participant BOOLEAN;
  v_executive_role TEXT;
  v_is_head BOOLEAN;
  v_is_cohead BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE group_id = p_group_id AND user_id = p_user_id
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RETURN FALSE;
  END IF;

  SELECT chat_type INTO v_chat_type FROM chat_groups WHERE id = p_group_id;

  IF v_chat_type IN ('organization', 'unofficial', 'personal', 'committee', 'custom_group') THEN
    RETURN TRUE;
  END IF;

  IF v_chat_type = 'executive' THEN
    SELECT executive_role INTO v_executive_role FROM profiles WHERE id = p_user_id;
    RETURN v_executive_role IS NOT NULL;
  END IF;

  IF v_chat_type = 'heads' THEN
    SELECT EXISTS (
      SELECT 1 FROM committee_members WHERE user_id = p_user_id AND position = 'head'
    ) INTO v_is_head;
    RETURN v_is_head;
  END IF;

  IF v_chat_type = 'coheads' THEN
    SELECT EXISTS (
      SELECT 1 FROM committee_members WHERE user_id = p_user_id AND position = 'co_head'
    ) INTO v_is_cohead;
    RETURN v_is_cohead;
  END IF;

  RETURN FALSE;
END;
$$;

-- Client sends portal + push after each message so chat notify no longer depends on these triggers.
DROP TRIGGER IF EXISTS trigger_notify_on_message ON public.direct_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_group_message ON public.group_messages;

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = p_user_id
      AND type = p_type
      AND title = p_title
      AND message = p_message
      AND created_at > NOW() - INTERVAL '12 seconds'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_link)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;
