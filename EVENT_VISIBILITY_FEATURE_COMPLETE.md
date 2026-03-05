# ✅ Event Visibility Configuration - COMPLETE

## Feature Overview

Admin can now configure when events become visible to committees OTHER than the proposing committee.

## Configuration Options

In **Workflow Config** page, admin can choose:

### Option 1: Visible Once Proposed (Most Open)
- **Setting**: `once_proposed`
- **Behavior**: All committees see events immediately after proposal
- **Status**: Events visible at `pending_head_approval`, `pending_ec_approval`, and `active`
- **Use Case**: Maximum transparency, all committees aware of all activities

### Option 2: Visible After Head Approval (Balanced)
- **Setting**: `after_head_approval` (Default)
- **Behavior**: All committees see events after committee head approves
- **Status**: Events visible at `pending_ec_approval` and `active`
- **Use Case**: Events are vetted by head before wider visibility

### Option 3: Visible After Active (Most Restricted)
- **Setting**: `after_active`
- **Behavior**: Only proposing committee sees events until EC approves
- **Status**: Events visible only at `active`
- **Use Case**: Maximum privacy, only finalized events are public

## Visibility Rules

### Always Visible (Regardless of Setting):
1. **Proposing Committee** - Always sees their own events at all stages
2. **EC Members** - Always see all events for approval purposes
3. **Admins** - Always see all events for management
4. **Faculty** - Always see all events for oversight

### Controlled by Setting:
- **Other Committees** - Visibility depends on admin configuration

## Implementation

### Database
- Stored in `workflow_config` table
- Type: `event_visibility`
- Config field: `visibility_to_other_committees`

### Files Created
1. `lib/event-visibility.ts` - Utility functions for checking visibility
   - `isEventVisibleToUser()` - Check if single event is visible
   - `filterVisibleEvents()` - Filter array of events

### Files Updated
1. `app/dashboard/workflow-config/page.tsx` - Added visibility configuration UI

## How to Use

### For Admin:
1. Go to Dashboard → Admin → Workflow Configuration
2. Find "Event Visibility to Other Committees" section
3. Select desired visibility level
4. Click "Save Configuration"

### For Developers:
```typescript
import { isEventVisibleToUser, filterVisibleEvents } from '@/lib/event-visibility';

// Check single event
const isVisible = await isEventVisibleToUser(event, userProfile, userCommittees);

// Filter array of events
const visibleEvents = await filterVisibleEvents(events, userProfile, userCommittees);
```

## Example Scenarios

### Scenario 1: Maximum Transparency
**Setting**: `once_proposed`

- Social Committee proposes "Tech Talk" → Status: `pending_head_approval`
- **Visible to**: Social Committee, EC, Admin, ALL other committees ✅
- **Result**: Everyone knows about the event from day 1

### Scenario 2: Balanced Approach
**Setting**: `after_head_approval` (Default)

- Social Committee proposes "Tech Talk" → Status: `pending_head_approval`
- **Visible to**: Social Committee, EC, Admin only
- Social Head approves → Status: `pending_ec_approval`
- **Visible to**: Social Committee, EC, Admin, ALL other committees ✅
- **Result**: Events are vetted before wider visibility

### Scenario 3: Maximum Privacy
**Setting**: `after_active`

- Social Committee proposes "Tech Talk" → Status: `pending_head_approval`
- **Visible to**: Social Committee, EC, Admin only
- Social Head approves → Status: `pending_ec_approval`
- **Visible to**: Social Committee, EC, Admin only
- EC approves (2/6) → Status: `active`
- **Visible to**: Social Committee, EC, Admin, ALL other committees ✅
- **Result**: Only finalized events are public

## Where Visibility Applies

### Pages Affected:
1. **Events Page** (`/events`) - Public page showing active events
2. **Dashboard Events** - Shows events based on visibility
3. **Committee Pages** - Shows events based on visibility
4. **Homepage Upcoming Events** - Shows active events only

### Pages NOT Affected:
1. **Proposals Page** - Always shows based on approval role
2. **Event Progress** - Only shows active events
3. **Admin Pages** - Admins always see everything

## Database Schema

```sql
-- workflow_config table
{
  workflow_type: 'event_visibility',
  config: {
    visibility_to_other_committees: 'once_proposed' | 'after_head_approval' | 'after_active'
  }
}
```

## Testing Checklist

- [ ] Admin can change visibility setting
- [ ] Setting persists after save
- [ ] Proposing committee always sees their events
- [ ] EC always sees all events
- [ ] Admin always sees all events
- [ ] Other committees see events based on setting
- [ ] Public events page shows only active events
- [ ] Dashboard respects visibility rules

## Notes

- Default setting is `after_active` (most restrictive)
- Setting applies immediately after save
- No page refresh needed for users
- Visibility check happens on every page load
- Performance optimized with single config query

## Future Enhancements

Possible additions:
- Per-committee visibility overrides
- Time-based visibility (e.g., visible 7 days before event)
- Notification when event becomes visible
- Visibility history/audit log
- Committee-specific visibility rules

---

**Summary**: Admin can now control when events become visible to other committees through a simple dropdown in Workflow Config. The system maintains proper access for proposing committee, EC, and admins while giving flexibility for inter-committee visibility.
