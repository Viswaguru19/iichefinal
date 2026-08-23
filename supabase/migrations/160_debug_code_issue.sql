-- ============================================
-- DEBUG: Check if committee_members query works
-- ============================================

-- Test the exact query the code uses
-- Replace USER_ID with the Alumni head's user ID

SELECT 
    p.*,
    json_agg(
        json_build_object(
            'position', cm.position,
            'committee_id', cm.committee_id
        )
    ) as committee_members
FROM profiles p
LEFT JOIN committee_members cm ON cm.user_id = p.id
WHERE p.id = 'USER_ID_HERE'
GROUP BY p.id;

-- This simulates what the code does:
-- .select('*, committee_members(position, committee_id)')

-- Check if the result has committee_members array
-- If committee_members is NULL or empty [], that's the problem!

-- ============================================
-- Alternative: Check committee_members directly
-- ============================================

SELECT 
    cm.user_id,
    cm.committee_id,
    cm.position,
    c.name as committee_name,
    p.name as user_name
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
JOIN profiles p ON cm.user_id = p.id
WHERE c.name ILIKE '%alumni%'
  AND cm.position IN ('head', 'co_head');

-- If this returns results but the first query doesn't,
-- there's an issue with how Supabase handles the nested select
