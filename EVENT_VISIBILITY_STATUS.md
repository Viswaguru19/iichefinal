# Event Visibility Status - Current Implementation

## ✅ Already Working Correctly

### 1. Homepage Upcoming Events
**File**: `app/page.tsx` (line 67-73)
```typescript
const { data: upcomingEvents } = await supabase
  .from('events')
  .select('*')
  .eq('status', 'active')  // ✅ Only active events
  .gte('date', new Date().toISOString())
  .order('date')
  .limit(5);
```
**Status**: ✅ Only shows `active` events (EC approved)

### 2. Dashboard Upcoming Events
**File**: `app/dashboard/page.tsx` (line 78-85)
```typescript
const { data: upcomingEvents } = await supabase
  .from('events')
  .select('*')
  .eq('status', 'active')  // ✅ Only active events
  .gte('date', new Date().toISOString())
  .order('date', { ascending: true })
  .limit(5);
```
**Status**: ✅ Only shows `active` events (EC approved)

### 3. Event Progress Page
**File**: `app/dashboard/events/progress/page.tsx` (line 53-62)
```typescript
const { data: eventsData } = await supabase
  .from('events')
  .select(`...`)
  .eq('status', 'active')  // ✅ Only active events
  .order('date', { ascending: false });
```
**Status**: ✅ Only shows `active` events (EC approved)

### 4. Public Events Page
**File**: `app/events/page.tsx`
```typescript
const { data: events } = await supabase
  .from('events')
  .select(`...`)
  .eq('status', 'active')  // ✅ Only active events
  .order('date', { ascending: false });
```
**Status**: ✅ Only shows `active` events (EC approved)

## Event Status Flow

```
1. Event Proposed
   └─ status: pending_head_approval
      └─ Visible to: Proposing committee, EC, Admin

2. Head Approves
   └─ status: pending_ec_approval
      └─ Visible to: Proposing committee, EC, Admin
      └─ (Other committees see based on visibility setting)

3. EC Approves (2/6 members)
   └─ status: active ✅
      └─ Visible to: EVERYONE
      └─ Shows in:
         - Homepage upcoming events ✅
         - Dashboard upcoming events ✅
         - Event progress page ✅
         - Public events page ✅
         - All committee views ✅
```

## Visibility Setting Impact

The visibility setting in Workflow Config controls when OTHER committees (not proposing committee) can see events:

### Option 1: "once_proposed"
- Other committees see events at: `pending_head_approval`, `pending_ec_approval`, `active`
- Does NOT affect homepage/progress (still only `active`)

### Option 2: "after_head_approval" (Default)
- Other committees see events at: `pending_ec_approval`, `active`
- Does NOT affect homepage/progress (still only `active`)

### Option 3: "after_active"
- Other committees see events at: `active` only
- Does NOT affect homepage/progress (still only `active`)

## Always Visible (Regardless of Setting)

1. **Proposing Committee** - Always sees their own events
2. **EC Members** - Always see all events
3. **Admins** - Always see all events
4. **Homepage/Progress** - Always only shows `active` events

## If You're Seeing Non-Active Events

### Possible Causes:

1. **Admin manually changed status**
   - Check: Go to Admin → All Events
   - Look for events with `active` status that shouldn't be active
   - Solution: Edit the event and change status back

2. **Old events from before workflow changes**
   - Check: Look at event creation dates
   - Solution: Delete or update old test events

3. **Browser cache**
   - Solution: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Or clear browser cache

4. **Database has events with wrong status**
   - Check with this SQL:
   ```sql
   SELECT id, title, status, created_at 
   FROM events 
   WHERE status = 'active'
   ORDER BY created_at DESC;
   ```

## How to Fix

### If events are showing without EC approval:

1. **Check event status in database**:
   ```sql
   SELECT id, title, status FROM events WHERE status != 'active';
   ```

2. **Update incorrect statuses**:
   ```sql
   UPDATE events 
   SET status = 'pending_ec_approval' 
   WHERE status = 'active' 
   AND id = 'event-id-here';
   ```

3. **Or use Admin panel**:
   - Go to Dashboard → Admin → All Events
   - Find the event
   - Click Edit
   - Change status to correct value
   - Save

## Testing Checklist

- [ ] Homepage shows only `active` events
- [ ] Dashboard shows only `active` events
- [ ] Event Progress shows only `active` events
- [ ] Public Events page shows only `active` events
- [ ] Proposing committee sees their events at all stages
- [ ] EC sees all events at all stages
- [ ] Other committees see events based on visibility setting
- [ ] Events become `active` only after 2 EC approvals

## Summary

All pages are correctly configured to show only `active` events (EC approved) in public-facing areas. If you're seeing non-active events, it's likely due to:
- Manual admin status changes
- Old test data
- Browser cache

The visibility setting only affects when OTHER committees can see events in their committee views, not the homepage or progress pages.
