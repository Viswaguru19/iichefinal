# 🔧 FIX: Missing Columns Error

## Error You're Seeing

```
Could not find the 'head_rejected_at' column of 'events' in the schema cache
Could not find the 'edit_history' column of 'events' in the schema cache
```

## What Happened

The enhanced workflow features require new columns in the `events` table that haven't been added yet.

## Quick Fix (2 minutes)

### Step 1: Run SQL Script

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `FIX_MISSING_COLUMNS_NOW.sql`
4. Click **Run**
5. Wait for success message

### Step 2: Verify

You should see output like:

```
✅ ALL COLUMNS EXIST!

Columns added:
✅ head_rejection_reason
✅ head_rejected_at
✅ ec_revoke_reason
✅ ec_revoked_by
✅ ec_revoked_at
✅ edit_history
✅ last_edited_by
✅ last_edited_at

✅ SETUP COMPLETE!
```

### Step 3: Refresh Your App

1. Refresh your browser
2. Go to Proposals page
3. Error should be gone

## What This Script Does

1. Adds missing enum values (`rejected_by_head`, `pending_ec_approval`)
2. Adds 8 new columns to events table
3. Creates indexes for performance
4. Updates RLS policies
5. Verifies everything is set up correctly

## If You Still See Errors

Try these steps:

1. **Clear Supabase cache**: In Supabase Dashboard, go to Settings → API → Reset API cache
2. **Restart dev server**: Stop and restart your Next.js dev server
3. **Hard refresh browser**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

## Files Involved

- `FIX_MISSING_COLUMNS_NOW.sql` - Run this to fix the issue
- `app/dashboard/proposals/page.tsx` - Updated with defensive checks
- `components/proposals/EditEventModal.tsx` - Uses new columns
- `components/proposals/RevokeModal.tsx` - Uses new columns

## What You Get After Fix

Once the columns are added, you'll have:

✅ Head can review & edit events before approval
✅ Head can reject with reason (status: rejected_by_head)
✅ EC can see rejected events
✅ EC can revoke head rejections
✅ Full edit history tracking
✅ Audit trail for all changes

## Need Help?

If the error persists after running the SQL:

1. Check the SQL Editor output for any error messages
2. Verify you're connected to the correct Supabase project
3. Make sure you have admin/owner permissions on the project
4. Try running the SQL in smaller chunks if needed

---

**TL;DR**: Run `FIX_MISSING_COLUMNS_NOW.sql` in Supabase SQL Editor, then refresh your app.
