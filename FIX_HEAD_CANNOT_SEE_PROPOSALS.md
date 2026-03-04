## Fix: Committee Head Cannot See Proposals ✅

### Problem
Committee heads cannot see event proposals in the proposals tab to approve, reject, or review them.

### Root Causes

1. **Overly Complex Query Logic**
   - The proposals page had complex nested conditions that were filtering out events
   - Committee heads who were NOT EC members were restricted to only `pending_head_approval` status
   - This caused issues if the query logic didn't match exactly

2. **Possible RLS Policy Issues**
   - Row Level Security policies on the `events` table might be blocking access
   - Need to ensure committee heads can SELECT events from their committees

### Solutions Implemented

#### 1. Simplified Proposals Page Query (`app/dashboard/proposals/page.tsx`)

**Before** (Complex nested logic):
```typescript
if (isHead && !isEC && !isFaculty && !isAdmin) {
  query = query.in('committee_id', committeeIds).eq('status', 'pending_head_approval');
} else if (isEC && !isFaculty && !isAdmin) {
  query = query.in('status', ['pending_head_approval', ...]);
} else if (isFaculty || isAdmin) {
  query = query.in('status', ['pending_head_approval', ...]);
} else {
  query = query.in('committee_id', committeeIds);
}
```

**After** (Simple, clear logic):
```typescript
if (isFaculty || isAdmin || isEC) {
  // Faculty, Admin, and EC see all events - no filters
} else if (isHead && committeeIds.length > 0) {
  // Committee heads see their committee's events
  query = query.in('committee_id', committeeIds);
} else if (committeeIds.length > 0) {
  // Regular members see their committee's events
  query = query.in('committee_id', committeeIds);
}
```

**Key Changes:**
- ✅ Removed status filtering for committee heads
- ✅ Committee heads now see ALL events from their committee (not just pending_head_approval)
- ✅ Simpler logic = fewer bugs
- ✅ EC members see everything without filters

#### 2. Created RLS Policy Fix Script (`FIX_PROPOSAL_VISIBILITY_RLS.sql`)

This SQL script:
- ✅ Drops old conflicting RLS policies
- ✅ Creates comprehensive SELECT policy allowing:
  - Committee members to see their committee's events
  - EC members to see all events
  - Admins to see all events
  - Faculty to see all events
  - Proposers to see their own events
- ✅ Ensures INSERT policy allows heads/co-heads to create events
- ✅ Ensures UPDATE policy allows heads/EC/admin to approve events

#### 3. Created Debug Script (`DEBUG_PROPOSAL_VISIBILITY.sql`)

Helps diagnose issues by checking:
- Events pending head approval
- Committee heads and their committees
- Committee ID matches
- RLS policies
- Detailed event-to-head mapping

### How to Fix

#### Option 1: Code Fix Only (Try First)
The simplified query in `app/dashboard/proposals/page.tsx` should fix most issues.

1. Commit and push the changes
2. Test by logging in as committee head
3. Go to `/dashboard/proposals`
4. Should see events from your committee

#### Option 2: If Still Not Working, Run RLS Fix
If committee heads still can't see proposals, run the RLS policy fix:

```sql
-- Run this in Supabase SQL Editor
-- Copy from FIX_PROPOSAL_VISIBILITY_RLS.sql
```

This will recreate the RLS policies with correct permissions.

### Testing Steps

1. **As Regular Member (Head/Co-Head)**:
   - Log in
   - Go to `/dashboard/propose-event`
   - Create an event proposal
   - Note the committee

2. **As Committee Head**:
   - Log in as the head of that committee
   - Go to `/dashboard/proposals`
   - ✅ Should see the event
   - ✅ Should see "Approve as Head" button
   - Click approve

3. **As EC Member**:
   - Log in as EC member
   - Go to `/dashboard/proposals` or `/dashboard/events/workflow`
   - ✅ Should see the event at `pending_ec_approval`
   - ✅ Should see "Approve as EC Member" button

### Debug Queries

If still not working, run these queries:

```sql
-- 1. Check what events exist
SELECT id, title, status, committee_id 
FROM events 
WHERE status = 'pending_head_approval';

-- 2. Check who is head of that committee
SELECT cm.user_id, p.name, cm.committee_id, c.name as committee
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head');

-- 3. Check if committee_id matches
-- Replace with actual IDs from above queries
SELECT 
    e.committee_id as event_committee,
    cm.committee_id as head_committee,
    CASE WHEN e.committee_id = cm.committee_id THEN '✅ Match' ELSE '❌ No Match' END
FROM events e
CROSS JOIN committee_members cm
WHERE e.id = 'EVENT_ID_HERE'
  AND cm.user_id = 'HEAD_USER_ID_HERE';
```

### Files Modified
1. ✅ `app/dashboard/proposals/page.tsx` - Simplified query logic
2. ✅ `app/dashboard/events/workflow/page.tsx` - Already fixed for co-heads
3. ✅ `FIX_PROPOSAL_VISIBILITY_RLS.sql` - RLS policy fix (run if needed)
4. ✅ `DEBUG_PROPOSAL_VISIBILITY.sql` - Debug queries

### Status
✅ Code fix applied - simplified query logic  
⏳ Test with real data  
📋 RLS fix available if needed  

The simplified query should resolve the issue. If not, the RLS policy fix will ensure database-level permissions are correct.
