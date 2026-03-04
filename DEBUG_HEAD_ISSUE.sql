-- Debug why committee head cannot view proposals

-- 1. Check if user is actually a committee head
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
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name;

-- 2. Check events pending head approval
SELECT 
    e.id,
    e.title,
    e.status,
    e.committee_id,
    c.name as committee_name,
    proposer.name as proposed_by
FROM events e
JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE e.status = 'pending_head_approval'
ORDER BY e.created_at DESC;

-- 3. Check if committee IDs match
-- Replace USER_ID with the actual user ID of the head
SELECT 
    'User Committee' as source,
    cm.committee_id,
    c.name
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE' AND cm.position IN ('head', 'co_head')

UNION ALL

SELECT 
    'Event Committee' as source,
    e.committee_id,
    c.name
FROM events e
JOIN committees c ON e.committee_id = c.id
WHERE e.status = 'pending_head_approval';

-- 4. Check RLS policies on events table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'events';
