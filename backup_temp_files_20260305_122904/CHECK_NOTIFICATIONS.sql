-- ============================================
-- CHECK NOTIFICATIONS SYSTEM
-- ============================================

-- 1. Check all notifications
SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.read,
    p.name as recipient,
    p.email,
    n.created_at
FROM notifications n
JOIN profiles p ON n.user_id = p.id
ORDER BY n.created_at DESC
LIMIT 20;

-- 2. Check event approval notifications
SELECT 
    n.id,
    n.title,
    n.message,
    p.name as recipient,
    n.metadata->>'event_id' as event_id,
    e.title as event_title,
    n.created_at
FROM notifications n
JOIN profiles p ON n.user_id = p.id
LEFT JOIN events e ON (n.metadata->>'event_id')::uuid = e.id
WHERE n.type = 'event_approved'
ORDER BY n.created_at DESC;

-- 3. Check task assignment notifications
SELECT 
    n.id,
    n.title,
    n.message,
    p.name as recipient,
    n.metadata->>'task_id' as task_id,
    t.title as task_title,
    n.created_at
FROM notifications n
JOIN profiles p ON n.user_id = p.id
LEFT JOIN tasks t ON (n.metadata->>'task_id')::uuid = t.id
WHERE n.type = 'task_assigned'
ORDER BY n.created_at DESC;

-- 4. Check unread notifications by user
SELECT 
    p.name,
    p.email,
    COUNT(*) as unread_count
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.read = false
GROUP BY p.id, p.name, p.email
ORDER BY unread_count DESC;

-- 5. Check notifications for a specific user (replace USER_ID)
SELECT 
    type,
    title,
    message,
    link,
    read,
    created_at
FROM notifications
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC;

-- 6. Check if notifications table exists and has correct structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 7. Count notifications by type
SELECT 
    type,
    COUNT(*) as count,
    COUNT(CASE WHEN read = false THEN 1 END) as unread_count
FROM notifications
GROUP BY type
ORDER BY count DESC;

-- 8. Check recent event approvals and their notifications
SELECT 
    e.id as event_id,
    e.title as event,
    e.status,
    proposer.name as proposed_by,
    ec.name as ec_approved_by,
    e.head_approved_at,
    (SELECT COUNT(*) FROM notifications WHERE metadata->>'event_id' = e.id::text AND type = 'event_approved') as notification_sent
FROM events e
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
LEFT JOIN profiles ec ON e.head_approved_by = ec.id
WHERE e.status = 'approved'
ORDER BY e.head_approved_at DESC
LIMIT 10;

-- 9. Check recent task approvals and their notifications
SELECT 
    t.id as task_id,
    t.title as task,
    t.status,
    c.name as assigned_to,
    ec.name as ec_approved_by,
    t.ec_approved_at,
    (SELECT COUNT(*) FROM notifications WHERE metadata->>'task_id' = t.id::text AND type = 'task_assigned') as notifications_sent
FROM tasks t
LEFT JOIN committees c ON t.assigned_to_committee_id = c.id
LEFT JOIN profiles ec ON t.ec_approved_by = ec.id
WHERE t.ec_approved_by IS NOT NULL
ORDER BY t.ec_approved_at DESC
LIMIT 10;

-- 10. Check committee members who should receive task notifications
SELECT 
    t.id as task_id,
    t.title as task,
    c.name as committee,
    p.name as member,
    p.email,
    (SELECT COUNT(*) FROM notifications WHERE user_id = p.id AND metadata->>'task_id' = t.id::text) as notification_received
FROM tasks t
JOIN committees c ON t.assigned_to_committee_id = c.id
JOIN committee_members cm ON cm.committee_id = c.id
JOIN profiles p ON cm.user_id = p.id
WHERE t.status = 'not_started'
ORDER BY t.created_at DESC, c.name, p.name;

-- ============================================
-- TROUBLESHOOTING QUERIES
-- ============================================

-- If notifications are not being created, check:

-- 1. Does the notifications table exist?
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'notifications'
);

-- 2. Are there any RLS policies blocking inserts?
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'notifications';

-- 3. Check if the notification functions are being called
-- (Look in approval_logs for recent approvals)
SELECT 
    action,
    entity_type,
    new_status,
    user_role,
    created_at
FROM approval_logs
WHERE entity_type IN ('event', 'task')
ORDER BY created_at DESC
LIMIT 10;
