# Run This SQL to Fix Forms and Meetings

## Quick Fix

Use the **SIMPLE** version which is safe to run:

### File: `FIX_FORMS_MEETINGS_SIMPLE.sql`

This version:
- ✅ Won't error if tables already exist
- ✅ Only adds missing columns
- ✅ Creates ENUM types safely
- ✅ Includes verification queries
- ✅ Shows you what was done

## Steps

1. Open Supabase SQL Editor
2. Copy the entire contents of `FIX_FORMS_MEETINGS_SIMPLE.sql`
3. Paste and run
4. Check the output for success messages

## What It Does

### For Forms Table
- Adds `fields` column (JSONB) if missing
- Adds `is_active` column if missing
- Creates RLS policies
- Creates indexes

### For Meetings Table
- Creates table if it doesn't exist
- Creates ENUM types (`meeting_type`, `meeting_platform`)
- Creates RLS policies
- Creates indexes

## Expected Output

You should see:
```
✅ Schema fix completed successfully!
```

Plus tables showing:
- Forms table structure
- Meetings table structure
- ENUM types and their values
- Row counts

## After Running

Test these features:
1. Create a new form - should work
2. Create a new meeting - should work
3. View forms list - should work
4. View meetings list - should work

## If You Get Errors

### Error: "type meeting_type already exists"
**Solution**: This is fine! The script handles this gracefully.

### Error: "relation meetings already exists"
**Solution**: This is fine! The script checks before creating.

### Error: "column fields already exists"
**Solution**: This is fine! The script checks before adding.

## Troubleshooting

If forms/meetings still don't work after running the SQL:

1. **Check browser console** for specific errors
2. **Verify the migration ran**:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'forms';
   ```
   Should show: id, title, description, created_by, fields, is_active, created_at, updated_at

3. **Verify ENUM types exist**:
   ```sql
   SELECT typname FROM pg_type WHERE typname IN ('meeting_type', 'meeting_platform');
   ```
   Should return both types

4. **Check RLS policies**:
   ```sql
   SELECT policyname FROM pg_policies WHERE tablename IN ('forms', 'meetings');
   ```
   Should show multiple policies

## Files

- ✅ `FIX_FORMS_MEETINGS_SIMPLE.sql` - **USE THIS ONE** (safe)
- ❌ `FIX_FORMS_MEETINGS_SCHEMA.sql` - (old version, has issues)

## Status

After running the SQL:
- ✅ Forms creation will work
- ✅ Meetings creation will work
- ✅ No more "column does not exist" errors
- ✅ No more "type does not exist" errors
