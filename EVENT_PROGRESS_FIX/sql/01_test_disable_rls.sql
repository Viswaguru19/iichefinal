-- ============================================
-- STEP 1: TEST - Temporarily Disable RLS
-- ============================================
-- This disables RLS to confirm it's blocking the query
-- Run this first, then check Event Progress page
-- ============================================

ALTER TABLE events DISABLE ROW LEVEL SECURITY;

SELECT '✅ RLS DISABLED on events table' as status;
SELECT 'Go to Event Progress page - event should now appear' as next_step;
SELECT 'If event shows, RLS was the problem. Proceed to Step 2.' as conclusion;

-- NOTE: This is temporary for testing only
-- After confirming, run 02_fix_rls_policies.sql to properly fix it
