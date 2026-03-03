# 🔧 Fix "Failed to create profile" Error

## Quick Fix (5 Minutes)

### Step 1: Open Supabase Dashboard
Go to: **https://supabase.com/dashboard**

### Step 2: Select Your Project
Click on your **IIChE Portal** project

### Step 3: Open SQL Editor
Click **"SQL Editor"** in the left sidebar

### Step 4: Run the Setup Script
1. Click **"New Query"**
2. Open the file `QUICK_SETUP.sql` in your project folder
3. Copy ALL the content
4. Paste it into the SQL Editor
5. Click **"Run"** button

### Step 5: Verify It Worked
Run this query to check:
```sql
SELECT * FROM profiles LIMIT 1;
```

If you see column names (even with no data), it worked!

### Step 6: Try Login Again
Go to: **http://localhost:3001/login**

If you don't have an account:
1. Go to: **http://localhost:3001/signup**
2. Create an account
3. Login!

## ✅ What the Script Does

- Creates `profiles` table for user data
- Creates `committees` table with 3 default committees
- Creates `events` table for event management
- Creates `tasks` table for task tracking
- Sets up security policies
- Allows you to login immediately

## 🎯 After Setup

You can:
- ✅ Sign up for new accounts
- ✅ Login successfully
- ✅ View the ultra-premium progress bar
- ✅ Access all dashboard features

## 🆘 Still Not Working?

### Check Your Supabase URL
Make sure `.env.local` has the correct URL:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
```

Get the correct URL from: Supabase Dashboard → Settings → API → Project URL

### Check the Error Message
The error message will now tell you exactly what's wrong:
- "Database setup incomplete" → Run the SQL script
- "Profile not found" → Sign up first
- "Account pending approval" → Admin needs to approve you

## 📝 Summary

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste `QUICK_SETUP.sql`
4. Click Run
5. Try login again

**Done!** 🎉
