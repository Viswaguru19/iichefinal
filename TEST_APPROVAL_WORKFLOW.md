# Test the New Approval Workflow

## What Changed
The event approval workflow has been simplified:
- **Before**: Member → Head (approve) → EC (2 approvals) → Faculty (approve) → Active
- **After**: Member → Head (approve) → EC (1 approval) → Event Progress ✅

## How to Test

### Step 1: Check Current Events
Run this SQL to see existing events:
```sql
SELECT id, title, status, committee_id FROM events 
WHERE status = 'pending_head_approval' 
ORDER BY created_at DESC;
```

You should see 3 events currently at `pending_head_approval` status.

### Step 2: Test as Committee Head
1. Log in as a committee head
2. Go to `/dashboard/events/workflow`
3. You should see events from YOUR committee only
4. Click "Approve as Head" on an event
5. Event should move to `pending_ec_approval` status

### Step 3: Test as EC Member
1. Log in as an EC member (any executive_role)
2. Go to `/dashboard/events/workflow`
3. You should see:
   - Events at `pending_head_approval` (read-only, can't approve yet)
   - Events at `pending_ec_approval` (can approve)
4. Click "Approve as EC" on an event at `pending_ec_approval`
5. Event should immediately move to `approved` status (only 1 approval needed!)

### Step 4: Verify Event Progress
1. Go to `/dashboard/events/progress`
2. The approved event should now appear in the list
3. You can assign tasks to committees
4. Progress tracking should work

### Step 5: Test Rejection
1. As head or EC member, go to `/dashboard/events/workflow`
2. Click "Reject" on an event
3. Enter a rejection reason (required)
4. Event should move to `cancelled` status

## Expected Behavior

### For Committee Heads
- ✅ See only events from their committee at `pending_head_approval`
- ✅ Can approve or reject
- ✅ After approval, event goes to EC

### For EC Members
- ✅ See ALL events at `pending_head_approval` (read-only)
- ✅ See ALL events at `pending_ec_approval` (can approve)
- ✅ Only 1 EC approval needed (not 2)
- ✅ After approval, event goes to Event Progress

### For Regular Members
- ✅ Can propose events (if head/co-head)
- ✅ See approved events in Event Progress
- ✅ Cannot access workflow page

## Quick SQL Checks

### Check event status after head approval:
```sql
SELECT id, title, status, head_approved_by, head_approved_at 
FROM events 
WHERE head_approved_by IS NOT NULL;
```

### Check EC approvals:
```sql
SELECT e.title, ea.user_id, ea.approved, ea.approved_at, p.name
FROM ec_approvals ea
JOIN events e ON ea.event_id = e.id
JOIN profiles p ON ea.user_id = p.id
ORDER BY ea.approved_at DESC;
```

### Check approved events:
```sql
SELECT id, title, status, committee_id 
FROM events 
WHERE status = 'approved';
```

## Troubleshooting

### Event not showing in workflow page?
- Check the event status is `pending_head_approval` or `pending_ec_approval`
- For heads: verify you're the head of that committee
- For EC: verify your `executive_role` is not null

### Can't approve as EC?
- Check you haven't already approved (can only approve once)
- Verify event is at `pending_ec_approval` status
- Check your profile has `executive_role` set

### Event not in Event Progress?
- Verify event status is `approved` (not `pending_ec_approval`)
- Check the Event Progress page is querying for `approved` status
- Run: `SELECT * FROM events WHERE status = 'approved';`

## Database Users for Testing

You'll need accounts with these roles:
1. Committee head (position = 'head' in committee_members)
2. EC member (executive_role IS NOT NULL in profiles)
3. Regular member (to propose events)

Check who has these roles:
```sql
-- Committee heads
SELECT p.name, p.email, c.name as committee 
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position = 'head';

-- EC members
SELECT name, email, executive_role 
FROM profiles 
WHERE executive_role IS NOT NULL;
```
