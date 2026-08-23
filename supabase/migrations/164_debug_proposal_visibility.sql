-- ============================================
-- DEBUG: Why committee head cannot see proposal
-- ============================================

-- 1. Check the event you just proposed
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
ORDER BY e.created_at DESC
LIMIT 5;

-- 2. Check who is the head of that committee
-- Replace COMMITTEE_ID with the committee_id from query 1
SELECT 
    cm.user_id,
    cm.committee_id,
    cm.position,
    p.name as head_name,
    p.email,
    c.name as committee_name
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.committee_id = 'COMMITTEE_ID_HERE'
  AND cm.position IN ('head', 'co_head')
ORDER BY cm.position;

-- 3. Check if the head's user_id matches
-- This will show if there's a mismatch
SELECT 
    'Event' as source,
    e.committee_id,
    c.name as committee_name
FROM events e
JOIN committees c ON e.committee_id = c.id
WHERE e.status = 'pending_head_approval'

UNION ALL

SELECT 
    'Head' as source,
    cm.committee_id,
    c.name as committee_name
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head');

-- 4. Check RLS policies on events table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'events'
ORDER BY policyname;

-- 5. Detailed check: Match events to their committee heads
SELECT 
    e.id as event_id,
    e.title as event_title,
    e.committee_id as event_committee_id,
    ec.name as event_committee_name,
    proposer.name as proposed_by,
    cm.user_id as head_user_id,
    head.name as head_name,
    head.email as head_email,
    cm.position as head_position
FROM events e
LEFT JOIN committees ec ON e.committee_id = ec.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
LEFT JOIN committee_members cm ON cm.committee_id = e.committee_id AND cm.position IN ('head', 'co_head')
LEFT JOIN profiles head ON cm.user_id = head.id
WHERE e.status = 'pending_head_approval'
ORDER BY e.created_at DESC;

-- 6. Check if committee_id is NULL
SELECT 
    id,
    title,
    committee_id,
    status,
    CASE 
        WHEN committee_id IS NULL THEN '❌ NULL committee_id'
        ELSE '✅ Has committee_id'
    END as committee_status
FROM events
WHERE status = 'pending_head_approval';

-- 7. Check the exact committee_id format
SELECT 
    e.id,
    e.title,
    e.committee_id,
    LENGTH(e.committee_id::text) as committee_id_length,
    c.id as actual_committee_id,
    LENGTH(c.id::text) as actual_committee_id_length,
    CASE 
        WHEN e.committee_id = c.id THEN '✅ Match'
        ELSE '❌ No Match'
    END as match_status
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
WHERE e.status = 'pending_head_approval';
