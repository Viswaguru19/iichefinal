# Fix Hackathon Visibility + Task System Error

## Problem
1. "Hackathon" event showing in Event Progress when it shouldn't be (not properly approved)
2. Error: `relation "tasks" does not exist` - task system tables missing

## Solution
Run the complete fix SQL file that:
- Fixes event statuses (removes unapproved events from progress)
- Creates all task system tables

## Steps

### 1. Run the Complete Fix
Open Supabase Dashboard → SQL Editor → New Query

Copy and paste the entire contents of: `RUN_THIS_COMPLETE_FIX.sql`

Click "Run"

### 2. What This Does

**Part 1: Fix Event Status**
- Moves events without head approval back to `pending_head_approval`
- Moves events without enough EC approvals back to `pending_ec_approval`
- Only properly approved events will have `status='active'`
- "Hackathon" will be moved to correct status if not properly approved

**Part 2: Create Task System**
- Creates `tasks` table with EC approval workflow
- Creates `task_updates` table for progress tracking
- Creates `task_ec_approvals` table for 4 EC member approval
- Creates `task_assignments` table for internal committee assignments
- Sets up all RLS policies

### 3. Verify the Fix

After running the SQL, check:

1. **Event Progress page** - "Hackathon" should NOT appear if it wasn't properly approved
2. **Create a task** - Should work without "relation does not exist" error
3. **Task approval** - EC members can approve tasks before they go to committees

## Task Workflow (After Fix)

1. EC member creates task → Status: `pending_ec_approval`
2. 4 EC members approve → Status changes to `not_started`
3. Task appears for assigned committee
4. Committee head can assign internally using `task_assignments` table
5. Committee members update progress
6. Task marked complete

## Event Visibility Rules

Events only appear in Event Progress when:
- Status = `active`
- Head has approved (`head_approved_by` is set)
- Required number of EC members have approved (default: 2, configurable in workflow settings)

## Need Help?

If you still see "Hackathon" in Event Progress after running the fix:
1. Check the event's actual approval status in Supabase
2. The SQL will show you which events were fixed
3. Refresh the Event Progress page
