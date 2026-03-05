-- ============================================
-- STEP 2: ADD COLUMNS AND INDEXES
-- Run this AFTER STEP1_ADD_ENUM_VALUES.sql
-- ============================================

-- Add all missing columns
ALTER TABLE events
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS head_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS head_rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ec_revoke_reason TEXT,
ADD COLUMN IF NOT EXISTS ec_revoked_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS ec_revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_head_rejected ON events(status) WHERE status = 'rejected_by_head';

-- Add comments
COMMENT ON COLUMN events.rejection_reason IS 'Reason provided when EC/Faculty rejects (cancelled status)';
COMMENT ON COLUMN events.head_rejection_reason IS 'Reason provided by committee head when rejecting';
COMMENT ON COLUMN events.head_rejected_at IS 'Timestamp when head rejected the event';
COMMENT ON COLUMN events.ec_revoke_reason IS 'Reason provided by EC when revoking head rejection';
COMMENT ON COLUMN events.ec_revoked_by IS 'EC member who revoked the head rejection';
COMMENT ON COLUMN events.ec_revoked_at IS 'Timestamp when EC revoked the rejection';
COMMENT ON COLUMN events.edit_history IS 'JSON array tracking all edits and status changes';
COMMENT ON COLUMN events.last_edited_by IS 'User who last edited the event details';
COMMENT ON COLUMN events.last_edited_at IS 'Timestamp of last edit';

-- Update RLS policies
DROP POLICY IF EXISTS "Committee heads can update their events" ON events;

CREATE POLICY "Committee heads can update their events"
ON events FOR UPDATE
USING (
  committee_id IN (
    SELECT committee_id FROM committee_members 
    WHERE user_id = auth.uid() 
    AND position IN ('head', 'co_head')
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'secretary') OR profiles.is_admin = true)
  )
);

-- Verify all columns exist
DO $$
DECLARE
  missing_columns TEXT[];
  col TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION RESULTS:';
  RAISE NOTICE '========================================';
  
  -- Check for missing columns
  SELECT ARRAY_AGG(column_name)
  INTO missing_columns
  FROM (
    SELECT unnest(ARRAY[
      'rejection_reason',
      'head_rejection_reason',
      'head_rejected_at',
      'ec_revoke_reason',
      'ec_revoked_by',
      'ec_revoked_at',
      'edit_history',
      'last_edited_by',
      'last_edited_at'
    ]) AS column_name
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events'
    AND column_name = expected.column_name
  );
  
  IF missing_columns IS NULL OR array_length(missing_columns, 1) IS NULL THEN
    RAISE NOTICE '✅ ALL COLUMNS EXIST!';
    RAISE NOTICE '';
    RAISE NOTICE 'Columns added:';
    RAISE NOTICE '✅ rejection_reason';
    RAISE NOTICE '✅ head_rejection_reason';
    RAISE NOTICE '✅ head_rejected_at';
    RAISE NOTICE '✅ ec_revoke_reason';
    RAISE NOTICE '✅ ec_revoked_by';
    RAISE NOTICE '✅ ec_revoked_at';
    RAISE NOTICE '✅ edit_history';
    RAISE NOTICE '✅ last_edited_by';
    RAISE NOTICE '✅ last_edited_at';
  ELSE
    RAISE NOTICE '⚠️ MISSING COLUMNS:';
    FOREACH col IN ARRAY missing_columns
    LOOP
      RAISE NOTICE '  ❌ %', col;
    END LOOP;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ STEP 2 COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Enhanced workflow is now ready:';
  RAISE NOTICE '• Head can review & edit events';
  RAISE NOTICE '• Head can reject with reason';
  RAISE NOTICE '• EC can revoke head rejections';
  RAISE NOTICE '• Full edit history tracking';
  RAISE NOTICE '';
  RAISE NOTICE 'Refresh your app to use new features!';
  RAISE NOTICE '========================================';
END $$;
