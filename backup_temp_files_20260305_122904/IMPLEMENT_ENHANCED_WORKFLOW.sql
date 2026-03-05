-- ============================================
-- ENHANCED APPROVAL WORKFLOW - DATABASE SETUP
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- Step 1: Add missing enum values
DO $$
BEGIN
  -- Add pending_ec_approval if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pending_ec_approval' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'pending_ec_approval';
  END IF;

  -- Add rejected_by_head if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'rejected_by_head' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'rejected_by_head';
  END IF;
END $$;

-- Step 2: Add new columns for enhanced workflow
ALTER TABLE events
ADD COLUMN IF NOT EXISTS head_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS head_rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ec_revoke_reason TEXT,
ADD COLUMN IF NOT EXISTS ec_revoked_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS ec_revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_head_rejected ON events(status) WHERE status = 'rejected_by_head';

-- Step 4: Add comments for documentation
COMMENT ON COLUMN events.head_rejection_reason IS 'Reason provided by committee head when rejecting';
COMMENT ON COLUMN events.ec_revoke_reason IS 'Reason provided by EC when revoking head rejection';
COMMENT ON COLUMN events.edit_history IS 'JSON array tracking all edits and status changes';
COMMENT ON COLUMN events.last_edited_by IS 'User who last edited the event details';
COMMENT ON COLUMN events.last_edited_at IS 'Timestamp of last edit';

-- Step 5: Update RLS policies to allow heads to update their events
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

-- Step 6: Verify setup
SELECT 
  'Event Status Enum Values' as check_name,
  STRING_AGG(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status');

SELECT 
  'New Columns Added' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN (
    'head_rejection_reason',
    'head_rejected_at',
    'ec_revoke_reason',
    'ec_revoked_by',
    'ec_revoked_at',
    'edit_history',
    'last_edited_by',
    'last_edited_at'
  )
ORDER BY column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ENHANCED WORKFLOW DATABASE SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Added:';
  RAISE NOTICE '✅ rejected_by_head status';
  RAISE NOTICE '✅ pending_ec_approval status';
  RAISE NOTICE '✅ Rejection tracking columns';
  RAISE NOTICE '✅ Edit history tracking';
  RAISE NOTICE '✅ RLS policies for head editing';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Implement UI components';
  RAISE NOTICE '========================================';
END $$;
