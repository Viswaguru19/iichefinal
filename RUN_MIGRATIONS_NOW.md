# 🔧 Run Database Migrations - Quick Guide

## The Problem

You're getting "Failed to create profile" because the database tables don't exist yet or don't have the right structure.

## The Solution

You need to run the migration files in your Supabase database.

## 📋 Step-by-Step Instructions

### Option 1: Run Migrations in Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Login to your account
   - Select your IIChE Portal project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run Each Migration File (IN ORDER)**

   Copy and paste the content of each file below, one at a time, and click "Run":

   **Migration 1**: `supabase/migrations/023_strict_role_based_system.sql`
   - This creates all the tables (profiles, events, tasks, etc.)
   - Click "Run" and wait for success

   **Migration 2**: `supabase/migrations/024_rls_policies.sql`
   - This sets up security policies
   - Click "Run" and wait for success

   **Migration 3**: `supabase/migrations/025_storage_buckets.sql`
   - This creates storage buckets for files
   - Click "Run" and wait for success

   **Migration 4**: `supabase/migrations/026_ec_approvals.sql`
   - This adds EC approval system
   - Click "Run" and wait for success

4. **Verify Tables Were Created**
   - Click on "Table Editor" in the left sidebar
   - You should see tables like: profiles, events, tasks, committees, etc.

### Option 2: Quick Check - Does profiles Table Exist?

1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
   ```sql
   SELECT * FROM profiles LIMIT 1;
   ```
3. If you get an error "relation profiles does not exist", you need to run the migrations

### Option 3: Create Just the Profiles Table (Quick Fix)

If you just want to login quickly, run this in SQL Editor:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'student',
  approved BOOLEAN DEFAULT false,
  is_faculty BOOLEAN DEFAULT false,
  avatar_url TEXT,
  phone TEXT,
  year INTEGER,
  branch TEXT,
  executive_role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow anyone to insert (for signup)
CREATE POLICY "Anyone can insert profile"
  ON profiles FOR INSERT
  WITH CHECK (true);
```

This will let you login immediately!

## ✅ After Running Migrations

1. Go back to your portal: http://localhost:3001/login
2. Try logging in again
3. If you don't have an account, go to: http://localhost:3001/signup
4. Create an account
5. Login successfully!

## 🆘 Still Having Issues?

### Check if Supabase URL is Correct

Your current `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=https://zaitflfjwxbywukpijww.supabase.co
```

Make sure this matches your project URL in Supabase Dashboard (Settings → API → Project URL)

### Check if Tables Exist

Run this in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see: profiles, events, tasks, committees, etc.

### Error Messages

If you see specific error messages, they will now be more helpful:
- "Database setup incomplete" → Run migrations
- "Profile not found" → Sign up first
- "Account pending approval" → Wait for admin approval

## 📝 Summary

1. Go to Supabase Dashboard
2. Open SQL Editor
3. Run migration files in order (023, 024, 025, 026)
4. Or run the quick profiles table creation script
5. Try logging in again

**That's it!** Your database will be ready and login will work.
