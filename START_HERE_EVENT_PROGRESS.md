# 🚀 START HERE - Fix Event Progress Visibility

## The Problem
You have 1 event in the database, but it's not showing in Event Progress page.

## Why This Happens
Events ONLY show in Event Progress after they reach `status='active'`. This happens when:
1. ✅ Committee Head approves the event
2. ✅ Required number of EC members approve (set in Workflow Config)
3. ✅ Event status is updated to 'active'

## 3-Step Solution

### STEP 1: Check Your Event Status
Run this SQL in Supabase SQL Editor:
```sql
-- Copy and paste: SHOW_MY_EVENT_STATUS.sql
```

This will tell you EXACTLY what your event needs.

### STEP 2: Get Required Approvals

#### Option A: If event needs HEAD approval
1. Log in as Committee Head or Co-Head
2. Go to **Dashboard → Proposals**
3. Find your event
4. Click **"Approve"** button

#### Option B: If event needs EC approval
1. Log in as EC member (Secretary, Associate Secretary, Joint Secretary, or Associate Joint Secretary)
2. Go to **Dashboard → Proposals**
3. Find your event
4. Click **"Approve"** button
5. Repeat with other EC members until you reach the required count

**How many EC approvals needed?**
- Check in **Dashboard → Workflow Config** (Super Admin only)
- Default is 2 EC approvals
- You can change this in Workflow Config

### STEP 3: Activate the Event
After getting all required approvals, run this SQL:
```sql
-- Copy and paste: FIX_EVENT_STATUS_RESPECT_CONFIG.sql
```

This updates your event status from 'pending_ec_approval' to 'active'.

### STEP 4: Verify
1. Go to **Dashboard → Event Progress**
2. Your event should now appear! 🎉

## Quick Diagnostic

Run these SQL files in order:

1. **SHOW_MY_EVENT_STATUS.sql** - See what your event needs
2. **FIX_EVENT_STATUS_RESPECT_CONFIG.sql** - Activate event after approvals
3. **CHECK_ACTUAL_EVENTS.sql** - Verify event is now active

## Understanding the Workflow

```
Event Created
    ↓
pending_head_approval ← Committee Head approves here
    ↓
pending_ec_approval ← EC members approve here (need X approvals based on config)
    ↓
active ← Event shows in Event Progress!
```

## Common Scenarios

### Scenario 1: "Event just created"
- Status: `pending_head_approval`
- Action: Committee Head needs to approve in Proposals page

### Scenario 2: "Head approved, waiting for EC"
- Status: `pending_ec_approval`
- Action: EC members need to approve in Proposals page
- Check: How many EC approvals are required? (Workflow Config)

### Scenario 3: "All approvals done, but not showing"
- Status: Still `pending_ec_approval` (not updated)
- Action: Run `FIX_EVENT_STATUS_RESPECT_CONFIG.sql`

### Scenario 4: "Event is active but not showing"
- This shouldn't happen! The Event Progress page filters by `status='active'`
- Check: Run `CHECK_ACTUAL_EVENTS.sql` to verify status

## Important Notes

✅ **Event Progress page code is CORRECT** - It already filters by `status='active'`

✅ **No faculty approval needed** - Faculty approval was removed from workflow

✅ **EC approval count is configurable** - Set in Workflow Config (default: 2)

✅ **Task system is working** - Uses existing `task_assignments` table

## Files Reference

| File | Purpose |
|------|---------|
| `SHOW_MY_EVENT_STATUS.sql` | Quick status check |
| `CHECK_EVENT_VISIBILITY_ISSUE.sql` | Detailed diagnostic |
| `FIX_EVENT_STATUS_RESPECT_CONFIG.sql` | Update event status to active |
| `CHECK_ACTUAL_EVENTS.sql` | Verify events in database |
| `EVENT_PROGRESS_TROUBLESHOOTING.md` | Detailed troubleshooting guide |

## Still Not Working?

1. Run `CHECK_EVENT_VISIBILITY_ISSUE.sql`
2. Check the output of each section
3. Verify workflow_config table exists
4. Ensure EC members have approved in the Proposals page (not just in database)

## Next Steps After Event Shows

Once your event appears in Event Progress:
1. Committee members can assign tasks
2. EC members can approve tasks
3. Committee members can update task progress
4. Track event completion with the Notion-style progress bar

---

**TL;DR**: Get head approval → Get EC approvals → Run FIX_EVENT_STATUS_RESPECT_CONFIG.sql → Event appears in Event Progress
