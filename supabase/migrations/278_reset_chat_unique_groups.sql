-- Wipe all chat history and rebuild one Official / Unofficial / EC / Heads / Co-heads / committee group set.
-- Unofficial must not use committee UUID 000…005 (Alumni), or the sidebar shows duplicates.

DELETE FROM public.message_polls;
DELETE FROM public.voice_messages;
DELETE FROM public.group_messages;
DELETE FROM public.direct_messages;
DELETE FROM public.chat_participants;
DELETE FROM public.chat_groups;
DELETE FROM public.notifications WHERE type IN ('chat', 'message');

ALTER TABLE public.chat_groups DROP CONSTRAINT IF EXISTS chat_groups_chat_type_check;
ALTER TABLE public.chat_groups
  ADD CONSTRAINT chat_groups_chat_type_check
  CHECK (chat_type IN (
    'personal', 'committee', 'organization', 'executive', 'heads', 'coheads', 'custom_group', 'unofficial'
  ));

INSERT INTO public.chat_groups (id, name, chat_type, description, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Official', 'organization', 'Official IIChE chat including faculty', NOW()),
  ('00000000-0000-0000-0000-000000000002', 'Office bearers (EC)', 'executive', 'Executive Committee / office bearers', NOW()),
  ('00000000-0000-0000-0000-000000000003', 'Heads', 'heads', 'All committee heads', NOW()),
  ('00000000-0000-0000-0000-000000000004', 'Co-heads', 'coheads', 'All committee co-heads', NOW()),
  ('c1a70000-0000-4000-8000-00000000000f', 'Unofficial', 'unofficial', 'Student chat without faculty', NOW());

INSERT INTO public.chat_groups (id, name, chat_type, committee_id, description, created_at)
SELECT gen_random_uuid(),
       CASE WHEN c.name ILIKE '%committee%' THEN c.name ELSE c.name || ' Committee' END,
       'committee',
       c.id,
       'Chat for ' || c.name || ' members',
       NOW()
FROM public.committees c
WHERE c.id <> '00000000-0000-0000-0000-000000000001';

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000001', id, NOW() FROM public.profiles
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT 'c1a70000-0000-4000-8000-00000000000f', id, NOW() FROM public.profiles
WHERE COALESCE(is_faculty, false) = false
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000002', id, NOW() FROM public.profiles
WHERE executive_role IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000003', user_id, NOW() FROM public.committee_members
WHERE position = 'head'
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT '00000000-0000-0000-0000-000000000004', user_id, NOW() FROM public.committee_members
WHERE position = 'co_head'
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (group_id, user_id, joined_at)
SELECT cg.id, cm.user_id, NOW()
FROM public.committee_members cm
INNER JOIN public.chat_groups cg
  ON cg.committee_id = cm.committee_id AND cg.chat_type = 'committee'
ON CONFLICT (group_id, user_id) DO NOTHING;

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
    VALUES ('c1a70000-0000-4000-8000-00000000000f', uid, now())
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
