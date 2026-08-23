-- ============================================
-- STEP 1: ADD ENUM VALUES
-- Run this FIRST, then run STEP2
-- ============================================

-- Add pending_ec_approval enum value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pending_ec_approval' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'pending_ec_approval';
    RAISE NOTICE '✅ Added pending_ec_approval enum value';
  ELSE
    RAISE NOTICE '✓ pending_ec_approval already exists';
  END IF;
END $$;

-- Add rejected_by_head enum value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'rejected_by_head' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'rejected_by_head';
    RAISE NOTICE '✅ Added rejected_by_head enum value';
  ELSE
    RAISE NOTICE '✓ rejected_by_head already exists';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ STEP 1 COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Enum values added:';
  RAISE NOTICE '✅ pending_ec_approval';
  RAISE NOTICE '✅ rejected_by_head';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Run STEP2_ADD_COLUMNS.sql';
  RAISE NOTICE '========================================';
END $$;
