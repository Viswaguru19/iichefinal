# Event Progress RLS Issue

## Problem

Events appear on the homepage but not in the Event Progress page.

## Cause

Row Level Security (RLS) policies are blocking client-side Supabase queries. The homepage uses server-side rendering (which bypasses RLS), while Event Progress uses client-side queries (subject to strict RLS).

## Solution

### Step 1: Verify the Issue

Run this diagnostic query in Supabase SQL Editor:

```sql
-- Check if event exists and is active
SELECT id, title, status, date
FROM events
WHERE status = 'active'
ORDER BY created_at DESC;
```

If you see events here but not in Event Progress, it's an RLS issue.

### Step 2: Fix RLS Policies

Run this in Supabase SQL Editor:

```sql
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Active events viewable by all" ON events;
DROP POLICY IF EXISTS "Events viewable by everyone" ON events;

-- Create simple policy that works for client-side queries
CREATE POLICY "public_read_events"
  ON events
  FOR SELECT
  USING (true);

-- Create policies for other operations
CREATE POLICY "authenticated_insert_events"
  ON events
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_events"
  ON events
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_events"
  ON events
  FOR DELETE
  USING (auth.uid() IS NOT NULL);
```

### Step 3: Verify Fix

1. Refresh the Event Progress page
2. Events should now appear
3. Clear browser cache if needed (Ctrl+Shift+R)

## Why This Happens

### Server-Side (Homepage)
- Uses Supabase service role key
- Bypasses or has elevated RLS permissions
- Can read all events

### Client-Side (Event Progress)
- Uses Supabase anonymous key
- Subject to strict RLS policies
- Blocked by complex policies with helper functions

## Technical Details

The original RLS policy used helper functions that don't work in client context:

```sql
-- This doesn't work client-side
CREATE POLICY "Active events viewable by all"
  ON events FOR SELECT
  USING (
    status = 'active' 
    OR is_ec_member(auth.uid())  -- Function might not exist
    OR is_admin(auth.uid())       -- Or doesn't work client-side
  );
```

The fix uses a simple policy that works in both contexts:

```sql
-- This works everywhere
CREATE POLICY "public_read_events"
  ON events FOR SELECT
  USING (true);
```

## Alternative: More Restrictive Policy

If you want to restrict event visibility:

```sql
CREATE POLICY "authenticated_read_events"
  ON events FOR SELECT
  USING (
    status IN ('active', 'completed')
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.is_admin = true
        OR profiles.executive_role IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM committee_members
          WHERE committee_members.user_id = auth.uid()
          AND committee_members.committee_id = events.committee_id
        )
      )
    )
  );
```

This allows:
- Everyone to see active/completed events
- Admins to see all events
- EC members to see all events
- Committee members to see their own committee's events

## Troubleshooting

### Events Still Not Showing

1. **Check browser console** (F12) for errors
2. **Verify RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE tablename = 'events';
   ```
3. **Check current policies**:
   ```sql
   SELECT policyname, cmd
   FROM pg_policies
   WHERE tablename = 'events';
   ```
4. **Clear browser cache** completely
5. **Check Supabase credentials** in `.env.local`

### Database Shows Event But UI Doesn't

This confirms it's an RLS issue. The database query works (uses service role) but the UI query doesn't (uses anon key).

**Solution**: Apply the RLS fix above.

## Prevention

When creating new RLS policies:
1. Test with both server-side and client-side queries
2. Avoid complex helper functions in policies
3. Use simple, explicit conditions
4. Test in browser console, not just SQL editor

## Related Issues

- Task assignments not showing: Same RLS issue, apply similar fix
- Forms not loading: Check RLS on `forms` table
- Committee data missing: Check RLS on `committees` and `committee_members` tables
