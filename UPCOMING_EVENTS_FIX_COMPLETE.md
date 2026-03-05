# Upcoming Events Filter Fix Complete ✅

## Issues Fixed

### 1. Unapproved Events Showing in Upcoming Events
Events with status `pending_head_approval`, `pending_ec_approval`, or `pending_faculty_approval` were appearing in the upcoming events section.

### 2. Inconsistent Date Column Usage
Some queries used `event_date` (old column) while others used `date` (new column).

### 3. Wrong Status Filter
Some pages were filtering by `approved = true` (old column) instead of `status = 'active'` (new workflow).

## Files Modified

### 1. `app/page.tsx` (Homepage)
- Changed filter from no status check to `.eq('status', 'active')`
- Now only shows fully approved events

### 2. `app/dashboard/page.tsx` (Dashboard)
- Changed from `.eq('status', 'approved')` to `.eq('status', 'active')`
- Ensures consistency with new workflow

### 3. `app/events/page.tsx` (Public Events Page)
- Changed from `.eq('approved', true)` to `.eq('status', 'active')`
- Changed from `event_date` to `date` column
- Fixed date display to use correct column

### 4. `app/dashboard/faculty/page.tsx` (Faculty Dashboard)
- Changed from `event_date` to `date` column in both queries
- Already had correct status filter

## SQL Fix Created

`FIX_UPCOMING_EVENTS_FILTER.sql` - Run this to:
1. Check current event statuses
2. Update any faculty-approved events to 'active' status
3. Verify which events will appear in upcoming events

## Event Status Workflow

Events go through these statuses:
1. `pending_head_approval` - Waiting for committee head
2. `pending_ec_approval` - Waiting for EC members (2/6 required)
3. `pending_faculty_approval` - Waiting for faculty advisor
4. `active` - Fully approved and visible to public ✅
5. `completed` - Event has finished
6. `cancelled` - Event was rejected/cancelled

## What Shows in "Upcoming Events" Now

Only events with:
- ✅ `status = 'active'` (fully approved)
- ✅ `date >= NOW()` (future events)
- ✅ Ordered by date

## Testing Checklist

- [ ] Run `FIX_UPCOMING_EVENTS_FILTER.sql` in Supabase
- [ ] Visit homepage - check upcoming events section
- [ ] Visit `/events` page - check all events shown
- [ ] Visit dashboard - check upcoming events widget
- [ ] Propose a new event - should NOT appear until approved
- [ ] Approve an event through full workflow - should appear after faculty approval

## Before vs After

### Before
```sql
-- Homepage (no status filter!)
SELECT * FROM events 
WHERE date >= NOW()
ORDER BY date LIMIT 5;

-- Events page (old column)
SELECT * FROM events 
WHERE approved = true
ORDER BY event_date DESC;
```

### After
```sql
-- Homepage (with status filter)
SELECT * FROM events 
WHERE status = 'active' 
  AND date >= NOW()
ORDER BY date LIMIT 5;

-- Events page (new column and status)
SELECT * FROM events 
WHERE status = 'active'
ORDER BY date DESC;
```

## Common Issues

### Issue: Events still showing without approval
**Solution**: Run `FIX_UPCOMING_EVENTS_FILTER.sql` to update event statuses

### Issue: No events showing at all
**Solution**: Check if any events have `status = 'active'`. You may need to manually approve some test events.

### Issue: Date showing as "Invalid Date"
**Solution**: Ensure events have the `date` column populated (not just `event_date`)

## Quick Test

1. Create a new event proposal
2. Check homepage - should NOT appear
3. Approve as head - should NOT appear
4. Approve as EC (2 members) - should NOT appear
5. Approve as faculty - should NOW appear ✅

## Database Query to Check

```sql
-- See what's currently showing
SELECT 
  title,
  status,
  date,
  head_approved_by IS NOT NULL as head_ok,
  faculty_approved_by IS NOT NULL as faculty_ok
FROM events
WHERE status = 'active' 
  AND date >= NOW()
ORDER BY date;
```

This should only show events that have been fully approved through the workflow.
