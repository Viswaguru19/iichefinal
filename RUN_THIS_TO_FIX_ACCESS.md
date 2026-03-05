# Fix Forms and Meetings Access - Quick Guide

## Error You Got
```
ERROR: 42883: function is_admin(uuid) does not exist
```

## Solution

You have 2 options:

### Option 1: Simple Fix (Recommended)
Run `FIX_COMMITTEES_AND_ACCESS_SIMPLE.sql`

This version doesn't use helper functions - it uses inline SQL checks instead.

### Option 2: Fix Helper Functions First
If you want to use helper functions:

1. First run: `FIX_HELPER_FUNCTIONS.sql`
2. Then run: `FIX_COMMITTEES_AND_ACCESS.sql`

---

## What Option 1 Does (Recommended)

The simple version replaces:
```sql
-- Old (uses helper function)
OR is_admin(auth.uid())

-- New (inline check)
OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.is_admin = TRUE
)
```

This achieves the same result without needing helper functions.

---

## After Running the SQL

Test that it works:

1. **Test Forms:**
   - Log in as any regular user (not admin/head)
   - Go to `/dashboard/forms`
   - Click "Create Form"
   - Should work without errors

2. **Test Meetings:**
   - Log in as any regular user
   - Go to `/dashboard/meetings`
   - Click "Schedule Meeting"
   - Should work without errors

---

## Why This Happened

The helper functions in migration 023 had incorrect syntax:
```sql
-- Wrong delimiter
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $    -- Should be $$
BEGIN
  ...
END;
$ LANGUAGE plpgsql;     -- Should be $$
```

The simple fix avoids this issue entirely by not using helper functions.

---

## Summary

1. Run `FIX_COMMITTEES_AND_ACCESS_SIMPLE.sql`
2. Test forms and meetings creation
3. Done!

The UI changes are already applied, so once the SQL runs, everything will work.
