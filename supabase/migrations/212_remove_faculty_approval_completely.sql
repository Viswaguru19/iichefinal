-- ============================================
-- REMOVE FACULTY APPROVAL COMPLETELY
-- ============================================
-- Faculty approval is not needed - EC approval is final
-- This removes all faculty approval columns and references
-- ============================================

-- Remove faculty approval columns from events table
ALTER TABLE events 
DROP COLUMN IF EXISTS faculty_approved_by CASCADE,
DROP COLUMN IF EXISTS faculty_approved_at CASCADE;

-- Remove faculty-related event statuses from enum
-- Note: Can't directly remove from enum, so we'll just not use them
-- Events should only use: pending_head_approval, pending_ec_approval, active, completed, cancelled, rejected_by_head

-- Update any events stuck in faculty approval status
UPDATE events
SET status = 'active'
WHERE status = 'pending_faculty_approval' OR status = 'faculty_approved';

-- Remove is_faculty column from profiles (optional - keep if faculty users exist for other purposes)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS is_faculty CASCADE;

-- Verification
SELECT 
  'Events table columns after cleanup:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name LIKE '%faculty%';

-- Should return no rows
SELECT 
  'Events with faculty-related status (should be 0):' as info,
  COUNT(*) as count
FROM events
WHERE status IN ('pending_faculty_approval', 'faculty_approved');

-- Show current event statuses
SELECT 
  'Current event statuses:' as info,
  status,
  COUNT(*) as count
FROM events
GROUP BY status
ORDER BY status;

SELECT 
  'Cleanup complete!' as info,
  'Faculty approval removed - EC approval is now final' as message;
