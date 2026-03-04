-- ============================================
-- VERIFY EVENT APPROVAL WORKFLOW STATUS
-- Run these queries to check the workflow is working
-- ============================================

-- 1. Check all events and their current status
SELECT 
    e.id,
    e.title,
    e.status,
    c.name as committee,
    proposer.name as proposed_by,
    head.name as head_approved_by,
    e.head_approved_at,
    e.created_at
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
LEFT JOIN profiles head ON e.head_approved_by = head.id
WHERE e.status IN ('pending_head_approval', 'pending_ec_approval', 'approved', 'cancelled')
ORDER BY e.created_at DESC;

-- 2. Check EC approvals for events
SELECT 
    e.title as event,
    e.status as event_status,
    p.name as ec_member,
    p.executive_role,
    ea.approved,
    ea.approved_at
FROM ec_approvals ea
JOIN events e ON ea.event_id = e.id
JOIN profiles p ON ea.user_id = p.id
ORDER BY ea.approved_at DESC;

-- 3. Count events by status
SELECT 
    status,
    COUNT(*) as count
FROM events
GROUP BY status
ORDER BY count DESC;

-- 4. Check committee heads who can approve
SELECT 
    p.name as head_name,
    p.email,
    c.name as committee,
    cm.position
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position = 'head'
ORDER BY c.name;

-- 5. Check EC members who can approve
SELECT 
    name,
    email,
    executive_role
FROM profiles
WHERE executive_role IS NOT NULL
ORDER BY executive_role;

-- 6. Check events pending head approval (what heads see)
SELECT 
    e.id,
    e.title,
    c.name as committee,
    c.id as committee_id,
    proposer.name as proposed_by,
    e.created_at
FROM events e
JOIN committees c ON e.committee_id = c.id
JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE e.status = 'pending_head_approval'
ORDER BY e.created_at DESC;

-- 7. Check events pending EC approval (what EC sees)
SELECT 
    e.id,
    e.title,
    c.name as committee,
    head.name as head_approved_by,
    e.head_approved_at,
    e.created_at
FROM events e
JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles head ON e.head_approved_by = head.id
WHERE e.status = 'pending_ec_approval'
ORDER BY e.created_at DESC;

-- 8. Check approved events (what appears in Event Progress)
SELECT 
    e.id,
    e.title,
    c.name as committee,
    e.date as event_date,
    e.location,
    e.budget,
    e.created_at
FROM events e
JOIN committees c ON e.committee_id = c.id
WHERE e.status = 'approved'
ORDER BY e.date ASC;

-- 9. Check if any events are stuck at old statuses
SELECT 
    status,
    COUNT(*) as count
FROM events
WHERE status IN ('pending_faculty_approval', 'faculty_approved', 'active')
GROUP BY status;

-- 10. Approval logs (audit trail)
SELECT 
    al.action,
    al.entity_type,
    al.previous_status,
    al.new_status,
    p.name as user,
    p.role as user_role,
    al.created_at
FROM approval_logs al
JOIN profiles p ON al.user_id = p.id
WHERE al.entity_type = 'event'
ORDER BY al.created_at DESC
LIMIT 20;
