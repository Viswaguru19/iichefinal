-- Fix Event Status Enum - Add Missing Value
-- Run this in Supabase SQL Editor

-- Step 1: Check current enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
ORDER BY enumsortorder;

-- Step 2: Add the missing enum value if it doesn't exist
DO $$
BEGIN
  -- Add pending_ec_approval if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pending_ec_approval' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
  ) THEN
    ALTER TYPE event_status ADD VALUE 'pending_ec_approval';
    RAISE NOTICE 'Added pending_ec_approval to event_status enum';
  ELSE
    RAISE NOTICE 'pending_ec_approval already exists in event_status enum';
  END IF;
END $$;

-- Step 3: Verify all enum values are present
SELECT enumlabel as "Event Status Values"
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_status')
ORDER BY enumsortorder;

-- Step 4: Check events table status column
SELECT 
  status,
  COUNT(*) as count
FROM events
GROUP BY status
ORDER BY count DESC;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Event status enum fixed!';
  RAISE NOTICE '✅ pending_ec_approval value added';
  RAISE NOTICE '========================================';
END $$;
