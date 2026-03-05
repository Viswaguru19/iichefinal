-- ============================================
-- FIX EVENT STATUS - MAKE APPROVED EVENTS ACTIVE
-- ============================================

-- Update events that have proper approvals to 'active' status
UPDATE events 
SET status = 'active', 
    updated_at = NOW()
WHERE head_approved_by IS NOT NULL 
  AND (
    SELECT COUNT(*) 
    FROM ec_approvals 
    WHERE event_id = events.id 
      AND approved = true
  ) >= 2;

-- Show results
SELECT 
  'Events now active:' as info,
  id,
  title,
  status,
  (SELECT COUNT(*) FROM ec_approvals WHERE event_id = events.id AND approved = true) as ec_approvals
FROM events
WHERE status = 'active'
ORDER BY created_at DESC;

SELECT 'Done! Refresh Event Progress page to see events.' as message;
