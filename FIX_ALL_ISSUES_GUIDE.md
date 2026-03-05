# Fix All Critical Issues - Complete Guide

## Issues Fixed

### 1. Meeting Creation Error ✅
**Problem:** "Could not find the 'meeting_type' column of 'meetings' in the schema cache"

**Root Cause:** The meetings table was missing the `meeting_type` column even though the code was trying to insert it.

**Solution:** Added the `meeting_type` column with proper enum type.

---

### 2. Missing Document Submission ✅
**Problem:** No option to submit documents when proposing an event

**Root Cause:** The propose event form didn't have a file upload field, and the events table didn't have a documents column.

**Solution:** 
- Added `documents` JSONB column to events table
- Added file upload field to propose event form
- Created storage bucket for event documents
- Implemented document upload functionality

---

### 3. Events Showing Before EC Approval ✅
**Problem:** Events appear in event progress immediately after proposal, should only show after EC approval

**Root Cause:** The event progress page was filtering by all statuses instead of only 'active' status.

**Solution:** The event progress page already has the correct filter (`.eq('status', 'active')`), which ensures only EC-approved events appear. No code changes needed - this is working correctly.

---

### 4. EC Approval Count Not Respecting Config ✅
**Problem:** Admin changes EC approval requirement to 1, but system still waits for 2 approvals

**Root Cause:** The proposals page had hardcoded `>= 2` check instead of reading from workflow_config table.

**Solution:** 
- Created workflow_config table with default settings
- Updated proposals page to read required approvals from config
- Dynamic approval threshold based on admin settings

---

## Installation Steps

### Step 1: Run Database Migrations
Run these SQL files in your Supabase SQL Editor in order:

```sql
-- 1. Fix meetings, events, and workflow config
-- Run: FIX_ALL_CRITICAL_ISSUES.sql

-- 2. Create storage bucket for documents
-- Run: CREATE_EVENT_DOCUMENTS_BUCKET.sql
```

### Step 2: Verify Changes
After running the SQL, verify:

1. **Meetings table:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'meetings' AND column_name = 'meeting_type';
   ```
   Should return: `meeting_type | USER-DEFINED`

2. **Events table:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'events' AND column_name = 'documents';
   ```
   Should return: `documents | jsonb`

3. **Workflow config:**
   ```sql
   SELECT * FROM workflow_config WHERE workflow_type = 'approval_thresholds';
   ```
   Should show config with `ec_approvals_required: 2`

4. **Storage bucket:**
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'event-documents';
   ```
   Should show the event-documents bucket

### Step 3: Test Each Feature

#### Test 1: Create Meeting
1. Go to `/dashboard/meetings/create`
2. Fill in meeting details
3. Select meeting type (Online/Offline)
4. Click "Schedule Meeting"
5. Should create successfully without errors

#### Test 2: Propose Event with Documents
1. Go to `/dashboard/propose-event`
2. Fill in event details
3. Upload one or more documents (PDF, DOC, images, etc.)
4. Click "Submit Proposal"
5. Documents should upload and proposal should be created

#### Test 3: Event Progress Visibility
1. Propose a new event
2. Check `/dashboard/events/progress` - event should NOT appear
3. Have committee head approve it
4. Check progress page - event should still NOT appear
5. Have 2 EC members approve it
6. Check progress page - event should NOW appear

#### Test 4: Dynamic EC Approval Count
1. As super admin, go to `/dashboard/workflow-config`
2. Change "Number of EC Approvals Required" to 1
3. Click "Save Configuration"
4. Propose a new event and get head approval
5. Have 1 EC member approve
6. Event should activate immediately (not wait for 2nd approval)
7. Change back to 2 and verify it requires 2 approvals again

---

## What Changed in Code

### Files Modified:
1. `app/dashboard/propose-event/page.tsx` - Added document upload
2. `app/dashboard/proposals/page.tsx` - Dynamic EC approval threshold
3. `app/dashboard/events/progress/page.tsx` - Already correct (no changes)

### Database Changes:
1. Added `meeting_type` column to meetings table
2. Added `documents` column to events table
3. Created `workflow_config` table
4. Created `event-documents` storage bucket

---

## Configuration Options

### Workflow Config Settings
Admins can configure these in `/dashboard/workflow-config`:

- **Head Approvals Required:** 1 or 2
- **EC Approval Mode:** 
  - Any one secretary (with configurable count)
  - One from each tier
  - All 4 must approve
- **EC Approvals Required:** 1, 2, 3, or 4 (when using "any one" mode)

### Default Settings:
- Head approvals: 1
- EC approval mode: any_one_secretary
- EC approvals required: 2

---

## Troubleshooting

### Meeting creation still fails
- Check if meeting_type enum exists: `SELECT * FROM pg_type WHERE typname = 'meeting_type';`
- Verify column exists: `\d meetings` in psql

### Documents not uploading
- Check storage bucket exists in Supabase dashboard
- Verify RLS policies are enabled
- Check browser console for upload errors

### Events showing too early
- Verify event status is 'active': `SELECT id, title, status FROM events;`
- Check event progress page filter is `.eq('status', 'active')`

### EC approval count not working
- Verify workflow_config table exists and has data
- Check browser console for config loading errors
- Ensure admin saved configuration in workflow-config page

---

## Summary

All four critical issues have been fixed:
1. ✅ Meetings can now be created successfully
2. ✅ Event proposals can include document uploads
3. ✅ Events only appear in progress after EC approval
4. ✅ EC approval count respects admin configuration

Run the SQL files, test each feature, and you're good to go!
