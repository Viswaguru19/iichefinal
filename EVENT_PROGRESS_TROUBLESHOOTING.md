# Event Progress Troubleshooting Guide

## Issue
Events are not showing in Event Progress page even though there's 1 event in the database.

## Why Events Don't Show
Events only appear in Event Progress AFTER they are fully approved and have status='active'. The approval workflow is:

1. **Committee Head Approval** - Head/Co-Head approves the event
2. **EC Approval** - Required number of EC members approve (configurable in Workflow Config)
3. **Status Changes to 'active'** - Event now shows in Event Progress

## Diagnostic Steps

### Step 1: Run Diagnostic SQL
```sql
-- Run this to see what's blocking your event
-- Copy and paste into Supabase SQL Editor
```
Run: `CHECK_EVENT_VISIBILITY_ISSUE.sql`

This will show you:
- Current workflow config settings (how many EC approvals needed)
- Your event's current status
- How many EC approvals it has
- What it needs to become active

### Step 2: Check Workflow Config
Go to: **Dashboard → Workflow Config** (Super Admin only)

Look at "EC Approvals Required" setting. This determines how many EC members must approve before an event becomes active.

Default: 2 EC approvals required

### Step 3: Get Required Approvals

#### If event needs HEAD approval:
1. Go to **Dashboard → Proposals**
2. Committee Head/Co-Head should see the event
3. Click "Approve" button

#### If event needs EC approval:
1. Go to **Dashboard → Proposals** (as EC member)
2. EC members (Secretary, Associate Secretary, Joint Secretary, Associate Joint Secretary) should see the event
3. Click "Approve" button
4. Repeat until required number of EC approvals is reached

### Step 4: Update Event Status
After getting all required approvals, run:
```sql
-- This updates events to 'active' based on workflow config
```
Run: `FIX_EVENT_STATUS_RESPECT_CONFIG.sql`

### Step 5: Verify
1. Refresh **Dashboard → Event Progress**
2. Your event should now appear!

## Quick Reference

### Event Status Flow
```
pending_head_approval → pending_ec_approval → active
     (Head approves)      (EC approves)      (Shows in Event Progress)
```

### Who Can Approve What
- **Committee Head/Co-Head**: Approve their own committee's events (first step)
- **EC Members**: Approve any event after head approval (final step)
  - Secretary
  - Associate Secretary
  - Joint Secretary
  - Associate Joint Secretary
- **Faculty**: NOT NEEDED (removed from workflow)

### Common Issues

**"No events in progress"**
- Event status is not 'active' yet
- Run diagnostic SQL to see what's needed

**"Event stuck at pending_head_approval"**
- Committee head needs to approve in Proposals page

**"Event stuck at pending_ec_approval"**
- Not enough EC approvals yet
- Check workflow config for required count
- EC members need to approve in Proposals page

**"Event has approvals but still not showing"**
- Event status might not be updated to 'active'
- Run FIX_EVENT_STATUS_RESPECT_CONFIG.sql

## Files to Use

1. `CHECK_EVENT_VISIBILITY_ISSUE.sql` - Diagnose the problem
2. `FIX_EVENT_STATUS_RESPECT_CONFIG.sql` - Fix event status after approvals
3. `ADD_WORKFLOW_CONFIG_SETTINGS.sql` - Create workflow config if missing

## Need Help?

If events still don't show after following these steps:
1. Run CHECK_EVENT_VISIBILITY_ISSUE.sql
2. Share the output
3. Check if workflow_config table exists and has settings
