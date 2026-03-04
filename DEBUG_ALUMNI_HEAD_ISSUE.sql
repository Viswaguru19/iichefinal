-- ============================================
-- DEBUG: Alumni Committee Head Cannot See Event
-- ============================================

-- 1. Check the alumni committee ID
SELECT id, name, type 
FROM committees 
WHERE name ILIKE '%alumni%';

-- 2. Check who is head of alumni committee
SELECT 
    cm.user_id,
    cm.committee_id,
    cm.position,
    p.name,
    p.email,
    c.name as committee_name
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE c.name ILIKE '%alumni%'
  AND cm.position IN ('head', 'co_head')
ORDER BY cm.position;

-- 3. Check if user has multiple committee memberships (OLD + NEW)
-- Replace USER_ID with the head's user ID
SELECT 
    cm.user_id,
    cm.committee_id,
    cm.position,
    c.name as committee_name,
    cm.created_at
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE'
ORDER BY cm.created_at DESC;

-- 4. Check the event you proposed
SELECT 
    e.id,
    e.title,
    e.status,
    e.committee_id,
    c.name as committee_name,
    proposer.name as proposed_by,
    proposer.id as proposer_id,
    e.created_at
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE e.status = 'pending_head_approval'
  AND c.name ILIKE '%alumni%'
ORDER BY e.created_at DESC;

-- 5. Check if committee IDs match
-- This will show if there's a mismatch between event committee and head committee
SELECT 
    'Event Committee' as source,
    e.committee_id,
    c.name as committee_name
FROM events e
JOIN committees c ON e.committee_id = c.id
WHERE e.status = 'pending_head_approval'
  AND c.name ILIKE '%alumni%'

UNION ALL

SELECT 
    'Head Committee' as source,
    cm.committee_id,
    c.name as committee_name
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
  AND c.name ILIKE '%alumni%';

-- 6. Check if the head user has OLD social committee membership still active
-- Replace USER_ID with the head's user ID
SELECT 
    cm.user_id,
    cm.committee_id,
    c.name as committee_name,
    cm.position,
    CASE 
        WHEN c.name ILIKE '%social%' THEN '❌ OLD - Should be removed'
        WHEN c.name ILIKE '%alumni%' THEN '✅ NEW - Correct'
        ELSE '⚠️ Other committee'
    END as status
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE';

-- 7. SOLUTION: Remove old committee membership if it exists
-- Uncomment and run this ONLY if query #6 shows old social committee membership
-- DELETE FROM committee_members 
-- WHERE user_id = 'USER_ID_HERE' 
--   AND committee_id IN (SELECT id FROM committees WHERE name ILIKE '%social%');

-- 8. Verify the fix - should show only alumni committee
-- SELECT 
--     cm.user_id,
--     cm.committee_id,
--     c.name as committee_name,
--     cm.position
-- FROM committee_members cm
-- JOIN committees c ON cm.committee_id = c.id
-- WHERE cm.user_id = 'USER_ID_HERE';
