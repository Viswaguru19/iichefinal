-- ============================================
-- TEMPORARY: DISABLE RLS FOR TESTING
-- ============================================
-- This completely disables RLS on events table
-- Use ONLY for testing, then re-enable
-- ============================================

-- Disable RLS
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

SELECT '✅ RLS DISABLED on events table' as message;
SELECT 'Go to Event Progress page and check if event shows now' as next_step;
SELECT 'If it works, the issue is definitely RLS policies' as conclusion;

-- To re-enable later, run:
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
