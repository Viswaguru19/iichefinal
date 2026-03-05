-- ============================================
-- FIX: Committee Membership When Moving Users
-- ============================================

-- STEP 1: Identify the user and committees
-- Find the user who was moved
SELECT id, name, email FROM profiles WHERE name ILIKE '%USER_NAME%';
-- Result: USER_ID

-- Find the committees
SELECT id, name FROM committees WHERE name ILIKE '%social%' OR name ILIKE '%alumni%';
-- Result: SOCIAL_COMMITTEE_ID, ALUMNI_COMMITTEE_ID

-- STEP 2: Check current memberships for this user
SELECT 
    cm.user_id,
    cm.committee_id,
    c.name as committee_name,
    cm.position,
    cm.created_at
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE'
ORDER BY cm.created_at DESC;

-- STEP 3: Remove OLD committee membership (Social)
-- Replace USER_ID and SOCIAL_COMMITTEE_ID with actual values
DELETE FROM committee_members 
WHERE user_id = 'USER_ID_HERE' 
  AND committee_id = 'SOCIAL_COMMITTEE_ID_HERE';

-- STEP 4: Ensure NEW committee membership exists (Alumni as head)
-- Replace USER_ID and ALUMNI_COMMITTEE_ID with actual values
INSERT INTO committee_members (user_id, committee_id, position)
VALUES ('USER_ID_HERE', 'ALUMNI_COMMITTEE_ID_HERE', 'head')
ON CONFLICT (user_id, committee_id) 
DO UPDATE SET position = 'head';

-- STEP 5: Verify the fix
SELECT 
    cm.user_id,
    p.name as user_name,
    cm.committee_id,
    c.name as committee_name,
    cm.position
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE';

-- Should show ONLY Alumni committee with position 'head'

-- ============================================
-- ALTERNATIVE: Clean up ALL duplicate memberships
-- ============================================

-- Find users with multiple committee memberships
SELECT 
    cm.user_id,
    p.name,
    COUNT(*) as committee_count,
    STRING_AGG(c.name, ', ') as committees
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
GROUP BY cm.user_id, p.name
HAVING COUNT(*) > 1
ORDER BY committee_count DESC;

-- ============================================
-- QUICK FIX: Use this if you know the exact IDs
-- ============================================

-- Example: Move user from Social to Alumni as head
-- 1. Get IDs first
WITH user_info AS (
    SELECT id FROM profiles WHERE email = 'user@example.com'
),
social_committee AS (
    SELECT id FROM committees WHERE name = 'Social Committee'
),
alumni_committee AS (
    SELECT id FROM committees WHERE name = 'Alumni Committee'
)
-- 2. Delete old membership
DELETE FROM committee_members 
WHERE user_id IN (SELECT id FROM user_info)
  AND committee_id IN (SELECT id FROM social_committee);

-- 3. Add new membership
WITH user_info AS (
    SELECT id FROM profiles WHERE email = 'user@example.com'
),
alumni_committee AS (
    SELECT id FROM committees WHERE name = 'Alumni Committee'
)
INSERT INTO committee_members (user_id, committee_id, position)
SELECT 
    (SELECT id FROM user_info),
    (SELECT id FROM alumni_committee),
    'head'
ON CONFLICT (user_id, committee_id) 
DO UPDATE SET position = 'head';
