# 🔧 FIX: Enum Transaction Error

## The Error You Got

```
ERROR: unsafe use of new value "rejected_by_head" of enum type event_status
HINT: New enum values must be committed before they can be used.
```

## Why This Happens

PostgreSQL requires enum values to be committed in a separate transaction before they can be used in indexes or queries. We need to run the SQL in two steps.

## Quick Fix (3 minutes)

### Step 1: Add Enum Values

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste **STEP1_ADD_ENUM_VALUES.sql**
3. Click **Run**
4. Wait for success message:
   ```
   ✅ STEP 1 COMPLETE!
   Enum values added:
   ✅ pending_ec_approval
   ✅ rejected_by_head
   ```

### Step 2: Add Columns and Indexes

1. In the same SQL Editor
2. Copy and paste **STEP2_ADD_COLUMNS.sql**
3. Click **Run**
4. Wait for success message:
   ```
   ✅ STEP 2 COMPLETE!
   Enhanced workflow is now ready
   ```

### Step 3: Refresh Your App

1. Refresh your browser (Ctrl+R or Cmd+R)
2. Go to Proposals page
3. Everything should work now!

## What Each Step Does

### STEP 1 (STEP1_ADD_ENUM_VALUES.sql)
- Adds `pending_ec_approval` to event_status enum
- Adds `rejected_by_head` to event_status enum
- Commits these changes

### STEP 2 (STEP2_ADD_COLUMNS.sql)
- Adds 8 new columns to events table
- Creates indexes (now safe to use new enum values)
- Updates RLS policies
- Verifies everything is set up

## Files to Run (In Order)

1. ✅ `STEP1_ADD_ENUM_VALUES.sql` - Run first
2. ✅ `STEP2_ADD_COLUMNS.sql` - Run second

## After Running Both Steps

You'll have these new features:

✅ Head can review & edit events before approval
✅ Head can reject with reason (status: rejected_by_head)
✅ EC can see rejected events
✅ EC can revoke head rejections
✅ Full edit history tracking
✅ Audit trail for all changes

## Troubleshooting

**If Step 1 fails:**
- Check if you have admin permissions
- Verify you're connected to the correct project
- Try refreshing the Supabase dashboard

**If Step 2 fails:**
- Make sure Step 1 completed successfully
- Check the error message in SQL Editor
- Verify the enum values were added (they should show in Step 1 output)

**If app still shows errors:**
- Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Restart Next.js dev server

## Why Two Steps?

PostgreSQL's transaction system requires:
1. Enum values must be added and committed
2. Only then can they be used in indexes, constraints, or WHERE clauses

Running everything in one script causes the "unsafe use" error because the enum values aren't committed yet when we try to create the index.

---

**TL;DR**: 
1. Run `STEP1_ADD_ENUM_VALUES.sql`
2. Run `STEP2_ADD_COLUMNS.sql`
3. Refresh your app
4. Done! ✅
