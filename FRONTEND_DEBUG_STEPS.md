# Frontend Debug Steps - Event Not Showing

## Database Status: ✅ CONFIRMED ACTIVE
Your event has `status='active'` in the database. The issue is in the frontend.

## Quick Fixes to Try

### 1. Hard Refresh Browser
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`
- Or: Clear browser cache completely

### 2. Check Browser Console
1. Go to Event Progress page: `/dashboard/events/progress`
2. Press `F12` to open Developer Tools
3. Go to "Console" tab
4. Look for any red errors
5. Share any errors you see

### 3. Check Network Tab
1. Open Developer Tools (`F12`)
2. Go to "Network" tab
3. Refresh the Event Progress page
4. Look for the Supabase API call to `events`
5. Click on it and check:
   - Status: Should be 200
   - Response: Should contain your event data

### 4. Verify Supabase Connection
Check your `.env.local` file has correct credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### 5. Restart Development Server
If running locally:
```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

## Common Issues

### Issue 1: Cached Data
The browser might be showing old cached data.
**Fix**: Hard refresh or clear cache

### Issue 2: Wrong User Logged In
Make sure you're logged in as a user who can see events.
**Fix**: Log out and log back in

### Issue 3: Supabase RLS Policy
The user might not have permission to see the event.
**Fix**: Check if you're logged in as committee member, EC, or admin

### Issue 4: Frontend Not Fetching
The React component might not be fetching data correctly.
**Fix**: Check browser console for errors

## What to Check in Browser Console

Look for errors like:
- `Failed to fetch` - Network/connection issue
- `Invalid API key` - Wrong Supabase credentials
- `Row level security policy` - Permission issue
- `undefined is not an object` - JavaScript error

## Next Steps

1. Try hard refresh first (easiest fix)
2. Check browser console for errors
3. Verify you're logged in as the right user
4. Check Network tab to see if data is being fetched

## If Still Not Working

The event IS active in the database. If it's still not showing after:
- Hard refresh
- Clearing cache
- Checking console for errors

Then share:
1. Any console errors
2. Network tab response for the events query
3. Which user you're logged in as (role/committee)
