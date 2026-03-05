# Proposals Visibility Fix Complete ✅

## Issues Fixed

### 1. "Failed to load events" Error
**Cause**: Incorrect foreign key reference syntax in the query
**Fix**: Updated to use proper Supabase foreign key syntax with explicit relationship names

### 2. Committee Heads Can't See Pending Proposals
**Cause**: RLS policies were too restrictive or missing
**Fix**: Created comprehensive RLS policy that allows committee members to see their committee's events

## Files Modified

### 1. `app/dashboard/proposals/page.tsx`
**Changed Query Syntax:**

Before (incorrect):
```typescript
committee:committee_id(name),
proposer:proposed_by(name),
```

After (correct):
```typescript
committee:committees!events_committee_id_fkey(name),
proposer:profiles!events_proposed_by_fkey(name),
```

This uses the proper Supabase syntax for foreign key relationships.

## SQL Fix Created

### `FIX_PROPOSALS_VISIBILITY_NOW.sql`

This script:
1. Removes old restrictive RLS policies
2. Creates comprehensive SELECT policy for events table
3. Ensures related tables (committees, profiles, committee_members, ec_approvals) are accessible
4. Allows proper visibility based on user role

### Who Can See What:

| Role | What They See |
|------|---------------|
| Super Admin / Secretary | All events |
| Faculty | All events |
| EC Members | All events |
| Committee Head/Co-Head | Their committee's events |
| Regular Committee Member | Their committee's events |
| Event Proposer | Events they proposed |

## RLS Policy Logic

```sql
CREATE POLICY "Users can view events based on role"
ON events FOR SELECT
USING (
  -- Admins see all
  (role IN ('super_admin', 'secretary') OR is_admin = true)
  OR
  -- Faculty see all
  is_faculty = true
  OR
  -- EC members see all
  executive_role IS NOT NULL
  OR
  -- Committee members see their committee's events
  committee_id IN (SELECT committee_id FROM committee_members WHERE user_id = auth.uid())
  OR
  -- Users see events they proposed/created
  proposed_by = auth.uid() OR created_by = auth.uid()
);
```

## How to Apply the Fix

### Step 1: Run SQL Fix
```bash
# In Supabase SQL Editor
# Copy and paste contents of FIX_PROPOSALS_VISIBILITY_NOW.sql
# Click "Run"
```

### Step 2: Restart Dev Server
```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

### Step 3: Test
1. Log in as a committee head
2. Go to Proposals page
3. Should see events with status `pending_head_approval` for their committee
4. No "Failed to load events" error

## Testing Checklist

### As Committee Head
- [ ] Can access `/dashboard/proposals` without error
- [ ] Can see events with `pending_head_approval` status
- [ ] Can see events from their committee only
- [ ] Can approve/reject events
- [ ] Console shows correct committee IDs

### As EC Member
- [ ] Can see all events regardless of committee
- [ ] Can see events at all approval stages
- [ ] Can approve events at EC stage

### As Faculty/Admin
- [ ] Can see all events
- [ ] Can approve at faculty stage
- [ ] No filtering by committee

### As Regular Member
- [ ] Can see their committee's events
- [ ] Cannot approve (no buttons shown)
- [ ] Can view status and details

## Common Issues and Solutions

### Issue: Still getting "Failed to load events"
**Check:**
1. Browser console for specific error message
2. Supabase logs for RLS policy violations
3. Network tab for failed requests

**Solution:**
```sql
-- Check if RLS is blocking the query
SELECT * FROM events LIMIT 1;
-- If this fails, RLS policy is too restrictive
```

### Issue: Committee head sees no events
**Check:**
1. User is actually a member of a committee
2. Committee has events with `pending_head_approval` status
3. `committee_id` in events matches user's committee

**Debug Query:**
```sql
-- Check user's committees
SELECT cm.committee_id, c.name
FROM committee_members cm
JOIN committees c ON cm.committee_id = c.id
WHERE cm.user_id = 'USER_ID_HERE';

-- Check events for those committees
SELECT e.id, e.title, e.status, e.committee_id
FROM events e
WHERE e.committee_id IN (
  SELECT committee_id FROM committee_members WHERE user_id = 'USER_ID_HERE'
);
```

### Issue: Foreign key reference error
**Symptom:** Error about invalid foreign key reference
**Solution:** Ensure foreign key names match database schema

**Check foreign keys:**
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'events';
```

## Debug Tools

### 1. Browser Console Logging
The proposals page now logs:
- Profile data
- Committee memberships
- Committee IDs
- User roles
- Query filters applied

Check console for these logs to debug visibility issues.

### 2. SQL Debug Script
Run `DEBUG_PROPOSALS_VISIBILITY.sql` to:
- See all pending events
- Check committee memberships
- View RLS policies
- Test queries as specific users

### 3. Supabase Dashboard
Check:
- Table Editor → events → Verify data exists
- Authentication → Users → Check user's auth.uid()
- Database → Policies → Verify RLS policies are active

## Event Status Flow

```
pending_head_approval
    ↓ (Committee Head approves)
pending_ec_approval
    ↓ (2 EC members approve)
pending_faculty_approval
    ↓ (Faculty approves)
active
```

Committee heads should see events at `pending_head_approval` stage.

## Performance Notes

The RLS policy uses subqueries which are efficient because:
1. PostgreSQL optimizes `IN (SELECT ...)` queries
2. Indexes exist on `committee_id` and `user_id`
3. Most users are in 1-2 committees max

If performance becomes an issue, consider:
- Adding index on `events.status`
- Materializing committee memberships
- Caching user roles in session

## Security Notes

- RLS policies are enforced at database level
- Cannot be bypassed from client code
- Each user only sees events they're authorized to see
- Admin/Faculty override is intentional for oversight

## Next Steps

1. Run `FIX_PROPOSALS_VISIBILITY_NOW.sql`
2. Test with different user roles
3. Monitor Supabase logs for any RLS violations
4. Check browser console for query errors
5. Verify all committee heads can see their pending events
