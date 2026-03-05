# Fix Date Field Issue - Complete Solution

## Problem
The codebase is inconsistently using `date` and `event_date` fields when querying the events table. The database schema uses `event_date`, but many parts of the code expect `date`.

## Root Cause
The events table in the database has a field called `event_date` (TIMESTAMPTZ), but the frontend code was written expecting a field called `date`.

## Solution Options

### Option 1: Update All Frontend Code (Current Approach)
Change all references from `event.date` to `event.event_date` throughout the codebase.

**Pros:**
- Matches actual database schema
- No database changes needed

**Cons:**
- Many files need updating
- Risk of missing some references

### Option 2: Add Database View or Alias (Recommended)
Create a database view or computed column that aliases `event_date` as `date`.

**Pros:**
- Minimal code changes
- Backward compatible
- Easier to maintain

**Cons:**
- Requires database migration

## Files Already Fixed

1. ✅ app/dashboard/event-detail/[id]/page.tsx
   - Changed `event.date` → `event.event_date`
   - Changed `event.venue` → `event.location`

2. ✅ app/dashboard/tasks/page.tsx
   - Changed query: `date` → `event_date`
   - Added error logging

3. ✅ app/dashboard/events/progress/page.tsx
   - Changed query: `date` → `event_date`
   - Changed `selectedEvent.date` → `selectedEvent.event_date`

## Files That Still Need Fixing

### High Priority (Breaks Functionality)
1. ❌ app/dashboard/proposals/page.tsx
   - Line 358: `new Date(proposal.date)`
   
2. ❌ app/dashboard/events/workflow/page.tsx
   - Line 184: `event.date`

3. ❌ app/dashboard/admin/events/page.tsx
   - Line 126: `event.date`
   - Line 171: `event.date`

4. ❌ components/proposals/EditEventModal.tsx
   - Line 18: `event.date`
   - Line 40: `event.date`

### Medium Priority (Display Issues)
5. ❌ components/dashboard/AnimatedUpcomingEvents.tsx
   - Line 47: `event.date`

6. ❌ app/page.tsx (Homepage)
   - Line 213: `event.date`

7. ❌ app/events/page.tsx (Public events)
   - Line 57: `event.date`

### Low Priority (Less Used Features)
8. ❌ app/dashboard/accounts/page.tsx
   - Line 232: `txn.date` (different table, not events)

## Recommended Approach

### Step 1: Add Database Alias (Quick Fix)
Run this SQL to add a computed column:

```sql
-- Add a generated column that aliases event_date as date
ALTER TABLE events ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ GENERATED ALWAYS AS (event_date) STORED;

-- Or use a view (alternative)
CREATE OR REPLACE VIEW events_with_date AS
SELECT *, event_date as date FROM events;
```

### Step 2: Update Critical Files
Fix the high-priority files that are currently broken:
- proposals/page.tsx
- events/workflow/page.tsx  
- admin/events/page.tsx
- EditEventModal.tsx

### Step 3: Update Display Files
Fix medium-priority files for better UX:
- AnimatedUpcomingEvents.tsx
- Homepage (app/page.tsx)
- Public events page

## Quick Fix for Testing

If you want to test immediately without fixing all files, you can:

1. Use the database view approach
2. Or update just the critical files listed above

## Testing Checklist

After fixes:
- [ ] Tasks page shows tasks correctly
- [ ] Event detail page loads
- [ ] Event progress page shows events
- [ ] Proposals page displays dates
- [ ] Can create new events
- [ ] Can edit events
- [ ] Event workflow page works
- [ ] Admin events page works

## Current Status

✅ Fixed:
- Event detail page
- Tasks page  
- Event progress page

❌ Still Broken:
- Proposals page (can't see dates)
- Event workflow page
- Admin events page
- Edit event modal

## Next Steps

1. Run the SQL migration to add the alias
2. OR update the remaining high-priority files
3. Test all event-related pages
4. Update medium-priority files for polish
