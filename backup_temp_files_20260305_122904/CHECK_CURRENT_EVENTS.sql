-- Check current events and their status
SELECT 
    id,
    title,
    status,
    committee_id,
    proposed_by,
    head_approved_by,
    head_approved_at,
    created_at
FROM events
WHERE status IN ('pending_head_approval', 'pending_ec_approval', 'approved')
ORDER BY created_at DESC;

-- Check if there are any EC approvals recorded
SELECT 
    event_id,
    user_id,
    approved,
    approved_at
FROM ec_approvals
ORDER BY approved_at DESC;

-- Check committee heads
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
WHERE cm.position = 'head'
ORDER BY c.name;

-- Check EC members
SELECT 
    id,
    name,
    email,
    executive_role
FROM profiles
WHERE executive_role IS NOT NULL
ORDER BY executive_role;
