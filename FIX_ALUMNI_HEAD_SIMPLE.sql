-- ============================================
-- SIMPLE FIX: Alumni Committee Head Issue
-- No manual ID replacement needed!
-- ============================================

-- STEP 1: Find all users who are heads of Alumni committee
SELECT 
    p.id as user_id,
    p.name,
    p.email,
    cm.position,
    c.name as committee_name
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE c.name ILIKE '%alumni%'
  AND cm.position IN ('head', 'co_head')
ORDER BY p.name;

-- STEP 2: Check if any of these users have multiple committee memberships
SELECT 
    p.name,
    p.email,
    COUNT(DISTINCT cm.committee_id) as committee_count,
    STRING_AGG(DISTINCT c.name, ' + ') as committees
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE p.id IN (
    SELECT cm2.user_id 
    FROM committee_members cm2
    JOIN committees c2 ON cm2.committee_id = c2.id
    WHERE c2.name ILIKE '%alumni%'
      AND cm2.position IN ('head', 'co_head')
)
GROUP BY p.id, p.name, p.email
HAVING COUNT(DISTINCT cm.committee_id) > 1;

-- If STEP 2 shows results, that user has multiple committees!

-- STEP 3: See the event that's pending
SELECT 
    e.id,
    e.title,
    e.status,
    c.name as committee_name,
    proposer.name as proposed_by,
    e.created_at
FROM events e
JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE e.status = 'pending_head_approval'
  AND c.name ILIKE '%alumni%'
ORDER BY e.created_at DESC;

-- STEP 4: FIX - Remove duplicate memberships for Alumni heads
-- This will keep ONLY the Alumni committee membership
WITH alumni_heads AS (
    SELECT DISTINCT cm.user_id
    FROM committee_members cm
    JOIN committees c ON cm.committee_id = c.id
    WHERE c.name ILIKE '%alumni%'
      AND cm.position IN ('head', 'co_head')
),
alumni_committee AS (
    SELECT id FROM committees WHERE name ILIKE '%alumni%'
)
DELETE FROM committee_members
WHERE user_id IN (SELECT user_id FROM alumni_heads)
  AND committee_id NOT IN (SELECT id FROM alumni_committee);

-- STEP 5: Verify the fix
SELECT 
    p.name,
    p.email,
    c.name as committee_name,
    cm.position
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE p.id IN (
    SELECT cm2.user_id 
    FROM committee_members cm2
    JOIN committees c2 ON cm2.committee_id = c2.id
    WHERE c2.name ILIKE '%alumni%'
      AND cm2.position IN ('head', 'co_head')
)
ORDER BY p.name, c.name;

-- Should show ONLY Alumni committee for each head

-- ============================================
-- ALTERNATIVE: If you know the user's email
-- ============================================

-- Replace 'user@example.com' with actual email
-- This removes ALL old memberships and keeps only Alumni as head

WITH target_user AS (
    SELECT id FROM profiles WHERE email = 'user@example.com'
),
alumni_committee AS (
    SELECT id FROM committees WHERE name ILIKE '%alumni%'
)
-- First, delete all memberships except Alumni
DELETE FROM committee_members
WHERE user_id IN (SELECT id FROM target_user)
  AND committee_id NOT IN (SELECT id FROM alumni_committee);

-- Then ensure Alumni membership exists as head
WITH target_user AS (
    SELECT id FROM profiles WHERE email = 'user@example.com'
),
alumni_committee AS (
    SELECT id FROM committees WHERE name ILIKE '%alumni%'
)
INSERT INTO committee_members (user_id, committee_id, position)
SELECT 
    (SELECT id FROM target_user),
    (SELECT id FROM alumni_committee),
    'head'
ON CONFLICT (user_id, committee_id) 
DO UPDATE SET position = 'head';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all committee heads and their committees
SELECT 
    p.name,
    p.email,
    c.name as committee_name,
    cm.position
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name, p.name;

-- Check events pending head approval
SELECT 
    e.title,
    c.name as committee_name,
    proposer.name as proposed_by,
    e.status
FROM events e
JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE e.status = 'pending_head_approval'
ORDER BY c.name, e.created_at DESC;
