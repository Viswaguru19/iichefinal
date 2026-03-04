# Quick Fix: Alumni Committee Head Cannot See Event

## Problem
You moved a user from Social Committee to Alumni Committee as head, but they cannot see the Alumni event in the proposals tab.

## Root Cause
The user likely has BOTH committee memberships in the database:
- ✅ Alumni Committee (new) - head
- ❌ Social Committee (old) - should be removed

The proposals page query uses ALL committee IDs, so if the old membership wasn't removed, the query might be confused.

## Quick Fix (Run in Supabase SQL Editor)

### Step 1: Find the User and Committee IDs

```sql
-- Find the user
SELECT id, name, email FROM profiles 
WHERE name ILIKE '%[USER_NAME]%';
-- Copy the user ID

-- Find Alumni committee
SELECT id, name FROM committees 
WHERE name ILIKE '%alumni%';
-- Copy the committee ID
```

### Step 2: Check Current Memberships

```sql
-- Replace USER_ID with actual ID from Step 1
SELECT 
    cm.committee_id,
    c.name as committee_name,
    cm.position
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE';
```

**Expected**: Should show ONLY Alumni Committee  
**If you see Social Committee too**: Continue to Step 3

### Step 3: Remove Old Social Committee Membership

```sql
-- Replace USER_ID with actual ID
DELETE FROM committee_members 
WHERE user_id = 'USER_ID_HERE' 
  AND committee_id IN (
    SELECT id FROM committees WHERE name ILIKE '%social%'
  );
```

### Step 4: Ensure Alumni Membership Exists

```sql
-- Replace USER_ID and ALUMNI_COMMITTEE_ID with actual IDs
INSERT INTO committee_members (user_id, committee_id, position)
VALUES ('USER_ID_HERE', 'ALUMNI_COMMITTEE_ID_HERE', 'head')
ON CONFLICT (user_id, committee_id) 
DO UPDATE SET position = 'head';
```

### Step 5: Verify

```sql
-- Check memberships again
SELECT 
    cm.committee_id,
    c.name as committee_name,
    cm.position
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE';
```

Should show ONLY:
- Alumni Committee | head

### Step 6: Test
1. Have the user log out and log back in (to clear session cache)
2. Go to `/dashboard/proposals`
3. Should now see the Alumni event

## Alternative: One-Line Fix

If you know the user's email:

```sql
-- Remove all old memberships and add Alumni as head
WITH user_info AS (
    SELECT id FROM profiles WHERE email = 'user@example.com'
),
alumni_committee AS (
    SELECT id FROM committees WHERE name ILIKE '%alumni%'
)
-- Delete ALL old memberships
DELETE FROM committee_members WHERE user_id IN (SELECT id FROM user_info);

-- Add Alumni membership
INSERT INTO committee_members (user_id, committee_id, position)
SELECT 
    (SELECT id FROM user_info),
    (SELECT id FROM alumni_committee),
    'head';
```

## Why This Happens

When you change a user's committee in the UI, it might:
1. Add the new committee membership ✅
2. But NOT remove the old one ❌

This causes the user to be in multiple committees, which confuses the query logic.

## Prevention

When moving users between committees, always:
1. Remove old committee membership first
2. Then add new committee membership
3. Or use a transaction to do both atomically

## Still Not Working?

If the user still can't see the event after fixing memberships:

1. **Check RLS Policies**: Run `FIX_PROPOSAL_VISIBILITY_RLS.sql`
2. **Check Event Committee ID**: Make sure the event's `committee_id` matches the Alumni committee ID
3. **Clear Browser Cache**: Have user clear cache or use incognito mode
4. **Check Session**: User must log out and log back in

## Debug Queries

Use `DEBUG_ALUMNI_HEAD_ISSUE.sql` for comprehensive debugging.
