-- Fix enum mismatch for event workflow statuses used by app code.
-- Safe on older DBs where events.status is still event_status enum.
-- No-op if event_status type is missing or already has these labels.

DO $$
DECLARE
  v_exists BOOLEAN;
  v_label TEXT;
  v_labels TEXT[] := ARRAY[
    'pending_second_head_approval',
    'review_by_cohead',
    'pending_ec_approval',
    'rejected_by_head',
    'in_progress'
  ];
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'event_status'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN;
  END IF;

  FOREACH v_label IN ARRAY v_labels LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'event_status'
        AND e.enumlabel = v_label
    ) THEN
      EXECUTE format('ALTER TYPE event_status ADD VALUE %L', v_label);
    END IF;
  END LOOP;
END;
$$;
