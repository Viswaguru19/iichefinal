-- Remove EC synthetic committee membership rows that were created automatically
-- when users were approved as `head` / `co_head`.
--
-- Desired behavior: only users with a real `profiles.executive_role` should be
-- treated as Executive Committee members (synthetic committee_id 000...0001).
--
-- This migration is safe/idempotent: it only deletes matching rows.

DO $$
DECLARE
  ec_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  DELETE FROM committee_members cm
  WHERE cm.committee_id = ec_id
    -- Only remove synthetic EC memberships for users who do NOT have an executive_role
    AND NOT EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = cm.user_id
        AND p.executive_role IS NOT NULL
        AND TRIM(p.executive_role::text) <> ''
    )
    -- Only remove when the user is a head/co_head in some other non-EC committee
    AND EXISTS (
      SELECT 1
      FROM committee_members other_cm
      WHERE other_cm.user_id = cm.user_id
        AND other_cm.committee_id <> ec_id
        AND other_cm.position IN ('head', 'co_head')
    );
END;
$$;

