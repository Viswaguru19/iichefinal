# Event Approval Workflow - Quick Reference

## Workflow Overview

```
Member Proposes Event
        ↓
[pending_head_approval]
        ↓
Committee Head Approves
        ↓
[pending_ec_approval]
        ↓
1 EC Member Approves
        ↓
[approved]
        ↓
Shows in Event Progress
```

## Status Values

| Status | Meaning | Who Can Act |
|--------|---------|-------------|
| `pending_head_approval` | Waiting for committee head | Committee head only |
| `pending_ec_approval` | Waiting for EC approval | Any 1 EC member |
| `approved` | Ready for execution | Shows in Event Progress |
| `cancelled` | Rejected | No further action |

## User Roles & Permissions

### Committee Head
- **Can see**: Events from their committee at `pending_head_approval`
- **Can do**: Approve or reject events
- **Page**: `/dashboard/events/workflow`

### EC Member (Any of 6)
- **Can see**: 
  - All events at `pending_head_approval` (read-only)
  - All events at `pending_ec_approval` (can approve)
- **Can do**: Approve or reject events at `pending_ec_approval`
- **Note**: Only 1 approval needed (not 2)
- **Page**: `/dashboard/events/workflow`

### Regular Member
- **Can see**: Approved events
- **Can do**: Propose events (if head/co-head), view progress
- **Page**: `/dashboard/propose-event`, `/dashboard/events/progress`

## Key Pages

| Page | URL | Purpose |
|------|-----|---------|
| Propose Event | `/dashboard/propose-event` | Submit new event proposal |
| Event Workflow | `/dashboard/events/workflow` | Approve/reject events |
| Event Progress | `/dashboard/events/progress` | Track approved events |
| Dashboard | `/dashboard` | See pending approvals summary |

## Database Tables

### `events`
Main table for all events
- `status`: Current approval status
- `proposed_by`: User who proposed
- `head_approved_by`: Committee head who approved
- `head_approved_at`: Timestamp of head approval
- `committee_id`: Which committee owns the event

### `ec_approvals`
Tracks individual EC member approvals
- `event_id`: Which event
- `user_id`: Which EC member
- `approved`: Boolean (true/false)
- `approved_at`: Timestamp

### `approval_logs`
Audit trail of all approval actions
- `action`: What happened (approve_as_head, approve_as_ec, etc.)
- `previous_status`: Status before action
- `new_status`: Status after action
- `user_id`: Who performed the action

## Common SQL Queries

### See pending events
```sql
SELECT id, title, status, committee_id 
FROM events 
WHERE status IN ('pending_head_approval', 'pending_ec_approval');
```

### See approved events
```sql
SELECT id, title, status 
FROM events 
WHERE status = 'approved';
```

### Check who approved an event
```sql
SELECT e.title, p.name, ea.approved_at
FROM ec_approvals ea
JOIN events e ON ea.event_id = e.id
JOIN profiles p ON ea.user_id = p.id
WHERE ea.event_id = 'EVENT_ID_HERE';
```

## Troubleshooting

### Event not showing for head?
- Check event's `committee_id` matches head's committee
- Verify status is `pending_head_approval`
- Check head's position in `committee_members` table

### Event not showing for EC?
- Check status is `pending_ec_approval`
- Verify user has `executive_role` set in profiles
- Check if user already approved (can only approve once)

### Event not in Event Progress?
- Verify status is `approved`
- Check Event Progress page queries for `approved` status
- Run: `SELECT * FROM events WHERE status = 'approved';`

## Testing Checklist

- [ ] Member proposes event → status = `pending_head_approval`
- [ ] Committee head sees event in workflow page
- [ ] EC members see event (read-only)
- [ ] Head approves → status = `pending_ec_approval`
- [ ] EC member sees event (can approve)
- [ ] EC member approves → status = `approved`
- [ ] Event appears in Event Progress
- [ ] Only 1 EC approval was needed
- [ ] Rejection works with reason

## Important Notes

1. **Only 1 EC approval needed** - Changed from 2 to 1
2. **No faculty approval** - Removed this step entirely
3. **Committee heads see only their events** - Not all events
4. **EC members see all events** - But can only approve after head
5. **Status is `approved` not `active`** - Changed terminology
