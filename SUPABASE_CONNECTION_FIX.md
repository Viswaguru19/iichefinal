# Fixing "Failed to Fetch" Login Error

## Problem
Getting "Failed to fetch" error when trying to login.

## Root Causes & Solutions

### ✅ Fix 1: Remove Database Type (COMPLETED)
**Issue:** The Database type import was causing type conflicts with Supabase client.

**Fixed Files:**
- `lib/supabase/client.ts` - Removed `<Database>` generic
- `lib/supabase/server.ts` - Removed `<Database>` generic

**Status:** ✅ FIXED

---

### Fix 2: Check Supabase Project Status

#### Step 1: Verify Project is Active
1. Go to https://supabase.com/dashboard
2. Check if your project is **Active** (not paused)
3. If paused, click "Resume Project"

#### Step 2: Check Project URL
Your current URL: `https://zaitflfjwxbywukpijww.supabase.co`

Test it:
```bash
curl https://zaitflfjwxbywukpijww.supabase.co/rest/v1/
```

Should return: `{"message":"The server is running"}`

If it returns an error, your project might be:
- Paused (free tier inactivity)
- Deleted
- Having connectivity issues

---

### Fix 3: Verify Environment Variables

Check `.env.local` has correct values:
```env
NEXT_PUBLIC_SUPABASE_URL=https://zaitflfjwxbywukpijww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** After changing `.env.local`, you MUST restart the dev server:
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

---

### Fix 4: Check CORS Settings

If running on localhost, Supabase should allow it by default.

To verify:
1. Go to Supabase Dashboard
2. Settings → API
3. Check "API Settings"
4. Ensure localhost is not blocked

---

### Fix 5: Check Browser Console

Open browser DevTools (F12) and check:

**Console Tab:**
- Look for specific error messages
- Check if it's a CORS error
- Check if it's a network error

**Network Tab:**
- Look for failed requests to Supabase
- Check the status code (404, 500, etc.)
- Check the response body

Common errors:
- `401 Unauthorized` → Wrong API key
- `404 Not Found` → Wrong URL or project paused
- `CORS error` → CORS configuration issue
- `Network error` → Internet/firewall issue

---

### Fix 6: Test Supabase Connection

Create a test page to verify connection:

**File:** `app/test-connection/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestConnection() {
  const [status, setStatus] = useState('Testing...');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    testConnection();
  }, []);

  async function testConnection() {
    try {
      const supabase = createClient();
      
      // Test 1: Check if client is created
      setStatus('Client created ✓');
      
      // Test 2: Try to fetch from a table
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (error) {
        setStatus('❌ Error: ' + error.message);
        setDetails(error);
        return;
      }
      
      setStatus('✅ Connection successful!');
      setDetails({ success: true, data });
      
    } catch (error: any) {
      setStatus('❌ Failed: ' + error.message);
      setDetails(error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
        
        <div className="mb-4">
          <p className="text-lg font-semibold">{status}</p>
        </div>
        
        {details && (
          <div className="bg-gray-100 p-4 rounded-lg">
            <pre className="text-xs overflow-auto">
              {JSON.stringify(details, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="mt-6 space-y-2 text-sm">
          <p><strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
          <p><strong>Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)}...</p>
        </div>
      </div>
    </div>
  );
}
```

**Test it:**
1. Save the file
2. Go to http://localhost:3000/test-connection
3. Check the result

---

### Fix 7: Clear Browser Cache

Sometimes cached data causes issues:

**Chrome/Edge:**
1. Press F12 (DevTools)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Or:**
1. Settings → Privacy → Clear browsing data
2. Select "Cached images and files"
3. Clear data

---

### Fix 8: Check Firewall/Antivirus

Some firewalls block Supabase:
- Temporarily disable firewall
- Try on a different network
- Try on mobile hotspot

---

### Fix 9: Verify Database Schema

The login tries to query `profiles` table with `username` field.

**Check if table exists:**
1. Go to Supabase Dashboard
2. Table Editor
3. Look for `profiles` table
4. Verify it has these columns:
   - `id` (uuid)
   - `email` (text)
   - `username` (text) ← Important!
   - `approved` (boolean)
   - `role` (text or enum)

**If `username` column is missing:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
```

---

### Fix 10: Check RLS Policies

Row Level Security might be blocking the query.

**Temporarily disable RLS for testing:**
```sql
-- In Supabase SQL Editor
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

**Test login again.**

**If it works, the issue is RLS policies. Re-enable and fix policies:**
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add policy to allow reading profiles during login
CREATE POLICY "Allow reading profiles for login"
  ON profiles FOR SELECT
  USING (true);
```

---

## Quick Diagnostic Checklist

Run through this checklist:

- [ ] Supabase project is active (not paused)
- [ ] `.env.local` has correct URL and keys
- [ ] Dev server restarted after env changes
- [ ] Browser cache cleared
- [ ] No CORS errors in console
- [ ] `profiles` table exists
- [ ] `username` column exists in profiles
- [ ] RLS policies allow SELECT on profiles
- [ ] Internet connection is working
- [ ] No firewall blocking Supabase

---

## Most Common Solutions

### Solution 1: Restart Dev Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Solution 2: Resume Paused Project
1. Go to Supabase Dashboard
2. Click "Resume Project"
3. Wait 2-3 minutes
4. Try again

### Solution 3: Fix RLS Policies
```sql
-- Allow reading profiles for authentication
CREATE POLICY "Public profiles are viewable"
  ON profiles FOR SELECT
  USING (true);
```

---

## Testing Steps

### Step 1: Test Supabase URL
```bash
curl https://zaitflfjwxbywukpijww.supabase.co/rest/v1/
```

### Step 2: Test with Postman/Insomnia
```
GET https://zaitflfjwxbywukpijww.supabase.co/rest/v1/profiles?select=count
Headers:
  apikey: YOUR_ANON_KEY
  Authorization: Bearer YOUR_ANON_KEY
```

### Step 3: Check Browser Console
1. Open login page
2. Press F12
3. Go to Console tab
4. Try to login
5. Look for error messages

### Step 4: Check Network Tab
1. Open login page
2. Press F12
3. Go to Network tab
4. Try to login
5. Look for failed requests
6. Click on failed request
7. Check Response tab

---

## If Nothing Works

### Last Resort: Create New Supabase Project

1. Go to https://supabase.com/dashboard
2. Create new project
3. Wait for provisioning
4. Copy new URL and keys
5. Update `.env.local`
6. Run migrations
7. Test again

---

## Current Status

✅ **Fixed:** Removed Database type from Supabase clients
⏳ **Next:** Test the connection

**Action Required:**
1. Restart your dev server
2. Try logging in again
3. Check browser console for errors
4. Report back what error you see
