-- ============================================
-- ADD 'active' ENUM VALUE TO event_status
-- ============================================

-- Add 'active' enum value if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'active' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'active';
    RAISE NOTICE '✅ Added active enum value';
  ELSE
    RAISE NOTICE '✓ active already exists';
  END IF;
END $$;

-- Verify all enum values
SELECT 
  'Event Status Enum Values' as check_name,
  STRING_AGG(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status');

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ACTIVE ENUM VALUE ADDED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'The event_status enum now includes:';
  RAISE NOTICE '• pending_head_approval';
  RAISE NOTICE '• pending_ec_approval';
  RAISE NOTICE '• rejected_by_head';
  RAISE NOTICE '• active ✅';
  RAISE NOTICE '• cancelled';
  RAISE NOTICE '';
  RAISE NOTICE 'Events become "active" after EC approval';
  RAISE NOTICE '========================================';
END $$;
