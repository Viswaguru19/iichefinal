# How to Get Your Supabase Credentials

## The Problem
Your Supabase project URL `zaitflfjwxbywukpijww.supabase.co` is not resolving. This typically happens when:
- The project was paused and restarted with a new URL
- The project was deleted and recreated
- There's a DNS propagation delay (rare)

## Solution: Get Fresh Credentials from Supabase Dashboard

### Step 1: Go to Your Supabase Dashboard
1. Visit https://supabase.com/dashboard
2. Log in to your account
3. Find your IIChE Portal project

### Step 2: Get Your Project URL
1. Click on your project
2. Go to **Settings** (gear icon in sidebar)
3. Click on **API** section
4. Look for **Project URL** - it should look like:
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```
5. Copy this ENTIRE URL

### Step 3: Get Your API Keys
In the same API settings page, you'll see:

1. **anon/public key** - A long JWT token starting with `eyJ...`
2. **service_role key** - Another long JWT token starting with `eyJ...`

Copy both of these.

### Step 4: Update Your .env.local File

Replace the values in your `.env.local` file with the NEW credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_NEW_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (your new anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (your new service_role key)
RESEND_API_KEY=re_a3P1WztN_E2qmj1UAXNfG7wPeGn6vVo5D
```

### Step 5: Verify Database is Active
1. In Supabase Dashboard, go to **Database** section
2. Make sure it shows "Active" status
3. If it says "Paused", click "Resume" and wait 2-3 minutes

### Step 6: Run Migrations (If New Project)
If this is a completely new Supabase project, you'll need to run all migrations:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run each migration file in order:
   - `supabase/migrations/023_strict_role_based_system.sql`
   - `supabase/migrations/024_rls_policies.sql`
   - `supabase/migrations/025_storage_buckets.sql`
   - `supabase/migrations/026_ec_approvals.sql`

### Step 7: Test the Connection
After updating `.env.local`:

```bash
npm run dev
```

Then visit http://localhost:3000 and try to sign up or log in.

## Quick Check: Is Your Project URL Different?

The publishable key you provided (`sb_publishable_2gDejZmusY_2yWX1Ha9Rlw_oIzAOYft`) suggests you might have a different project. 

**IMPORTANT**: The project reference in your URL should match the `ref` field in your JWT tokens. 

Decode your anon key at https://jwt.io and check the `ref` field - it should match your project URL.

Current ref in your token: `zaitflfjwxbywukpijww`
Current URL: `https://zaitflfjwxbywukpijww.supabase.co`

If these don't match, you need to update your credentials!

## Still Having Issues?

If the DNS still doesn't resolve after 30 minutes:
1. Contact Supabase support at https://supabase.com/support
2. Check Supabase status page: https://status.supabase.com
3. Try creating a fresh project and migrating your data
