-- ============================================
-- FORCE EVENT TO ACTIVE STATUS
-- ============================================
-- This manually sets the event to active
-- Use if event has approvals but status isn't updating
-- ============================================

-- First, show current status
SELECT 
  '📋 BEFORE UPDATE' as section,
  id,
  title,
  status,
  head_approved_by IS NOT NULL as has_head,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_count
FROM events
ORDER BY created_at DESC
LIMIT 1;

-- Force update to active
UPDATE events
SET 
  status = 'active',
  updated_at = NOW()
WHERE id = (SELECT id FROM events ORDER BY created_at DESC LIMIT 1)
  AND head_approved_by IS NOT NULL
  AND (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) >= 1;

-- Show after update
SELECT 
  '✅ AFTER UPDATE' as section,
  id,
  title,
  status,
  updated_at
FROM events
ORDER BY created_at DESC
LIMIT 1;

-- Verify it will show in Event Progress
SELECT 
  '👁️ WILL SHOW IN EVENT PROGRESS?' as section,
  CASE 
    WHEN EXISTS (SELECT 1 FROM events WHERE status = 'active')
    THEN '✅ YES - Event has status=active'
    ELSE '❌ NO - Event status is not active'
  END as result;

SELECT '🎉 Done! Refresh Event Progress page now.' as message;
