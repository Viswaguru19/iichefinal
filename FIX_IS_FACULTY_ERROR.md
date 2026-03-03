# 🔧 Fix "is_faculty column not found" Error

## The Problem
Your profiles table exists but is missing the `is_faculty` column (and possibly other columns).

## Quick Fix (2 Minutes)

### Step 1: Open Supabase Dashboard
Go to: **https://supabase.com/dashboard**

### Step 2: Open SQL Editor
1. Click on your project
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**

### Step 3: Run This Script

Copy and paste this into the SQL Editor:

```sql
-- Add missing columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_faculty BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Verify it worked
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
```

### Step 4: Click "Run"

You should see a list of all columns including `is_faculty`, `is_active`, and `is_admin`.

### Step 5: Try Login Again

Go to: **http://localhost:3001/login**

The error should be gone!

## Alternative: Use the File

I've created a file called `ADD_MISSING_COLUMNS.sql` in your project. You can:
1. Open that file
2. Copy ALL the content
3. Paste into Supabase SQL Editor
4. Click "Run"

## What This Does

- Adds `is_faculty` column (used to identify faculty members)
- Adds `is_active` column (used to activate/deactivate users)
- Adds `is_admin` column (used for admin permissions)
- All columns default to `false` for existing users
- Safe to run multiple times (won't duplicate columns)

## After Running

✅ Login will work
✅ Profile creation will work
✅ Faculty/Student detection will work
✅ Admin can set these flags for users

---

**Quick Command (Copy This)**:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_faculty BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
```

That's it! 🎉
