# 🔔 Notification System Flow Diagram

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SYSTEM                          │
│                                                                 │
│  Dashboard Header                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Logo] IIChE AVVU Dashboard    [🔔3] Profile Logout    │  │
│  │                                   ↑                       │  │
│  │                                   │                       │  │
│  │                          Notification Bell                │  │
│  │                          with Unread Badge                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Click Bell → Dropdown Opens                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Notifications                          [✓✓] [×]         │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │  📝 New Event Proposal                          [✓] [×]  │  │
│  │     New event "Tech Fest" proposed                       │  │
│  │     5m ago                                               │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │  ✅ Event Ready for EC Approval                 [✓] [×]  │  │
│  │     Event "Workshop" needs EC approval                   │  │
│  │     2h ago                                               │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │  ✅ Event Approved!                                      │  │
│  │     Your event "Seminar" is now active                   │  │
│  │     1d ago                                               │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │                View All Notifications                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Event Workflow with Notifications

```
┌─────────────────────────────────────────────────────────────────┐
│                      EVENT LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

1. EVENT PROPOSED
   ┌──────────────────────────────────────┐
   │  Committee Member proposes event     │
   │  Status: pending_head_approval       │
   └──────────────────────────────────────┘
                    │
                    ├─→ 🔔 Notification sent to:
                    │   • Committee Head
                    │   • Committee Co-Head
                    │
                    ↓
2. HEAD REVIEWS
   ┌──────────────────────────────────────┐
   │  Committee Head reviews event        │
   │  Options:                            │
   │  • Edit event details                │
   │  • Approve                           │
   │  • Reject                            │
   └──────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ↓                       ↓
   APPROVE                  REJECT
        │                       │
        │                       ├─→ 🔔 Notification sent to:
        │                       │   • Event Proposer
        │                       │   Status: rejected_by_head
        │                       │
        │                       ↓
        │                  EC CAN REVOKE
        │                       │
        │                       ├─→ 🔔 Notification sent to:
        │                       │   • Event Proposer
        │                       │   • Committee Head
        │                       │
        ↓                       ↓
   Status: pending_ec_approval
        │
        ├─→ 🔔 Notification sent to:
        │   • All EC Members (6 people)
        │
        ↓
3. EC APPROVAL
   ┌──────────────────────────────────────┐
   │  EC Members review event             │
   │  Need: 2 out of 6 approvals          │
   │  Progress: [██░░░░] 2/6              │
   └──────────────────────────────────────┘
                    │
                    ↓
   2 EC MEMBERS APPROVE
        │
        ├─→ 🔔 Notification sent to:
        │   • Event Proposer
        │   Status: active ✅
        │
        ↓
4. EVENT ACTIVE
   ┌──────────────────────────────────────┐
   │  Event is now active and visible     │
   │  Shows in:                           │
   │  • Homepage upcoming events          │
   │  • Dashboard upcoming events         │
   │  • Event progress page               │
   │  • Public events page                │
   └──────────────────────────────────────┘
```

## Notification Types & Recipients

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION MATRIX                          │
├──────────────┬──────────┬─────────────────────┬────────────────┤
│ Event        │ Icon     │ Notification        │ Recipients     │
├──────────────┼──────────┼─────────────────────┼────────────────┤
│ Proposed     │ 📝       │ New Event Proposal  │ Committee      │
│              │          │                     │ Heads          │
├──────────────┼──────────┼─────────────────────┼────────────────┤
│ Head         │ ✅       │ Ready for EC        │ All EC         │
│ Approved     │          │ Approval            │ Members        │
├──────────────┼──────────┼─────────────────────┼────────────────┤
│ EC Approved  │ ✅       │ Event Approved!     │ Event          │
│ (Active)     │          │                     │ Proposer       │
├──────────────┼──────────┼─────────────────────┼────────────────┤
│ Head         │ ❌       │ Rejected by Head    │ Event          │
│ Rejected     │          │                     │ Proposer       │
├──────────────┼──────────┼─────────────────────┼────────────────┤
│ Cancelled    │ ❌       │ Event Cancelled     │ Event          │
│              │          │                     │ Proposer       │
├──────────────┼──────────┼─────────────────────┼────────────────┤
│ EC Revokes   │ 🔄       │ Rejection Revoked   │ Proposer &     │
│ Rejection    │          │                     │ Head           │
└──────────────┴──────────┴─────────────────────┴────────────────┘
```

## Real-time Updates

```
┌─────────────────────────────────────────────────────────────────┐
│                    REAL-TIME FLOW                               │
└─────────────────────────────────────────────────────────────────┘

Event Occurs (e.g., Event Proposed)
        │
        ↓
Database Trigger Fires
        │
        ├─→ INSERT INTO notifications
        │   (user_id, type, title, message, link)
        │
        ↓
Supabase Realtime Broadcasts Change
        │
        ├─→ WebSocket Connection
        │
        ↓
NotificationBell Component Receives Update
        │
        ├─→ Updates notification list
        ├─→ Updates unread count badge
        ├─→ Shows new notification in dropdown
        │
        ↓
User Sees Notification Instantly (No Refresh!)
        │
        ├─→ Badge shows: 🔔 3
        ├─→ Dropdown updates automatically
        │
        ↓
User Clicks Notification
        │
        ├─→ Marks as read
        ├─→ Navigates to relevant page
        ├─→ Badge count decreases
```

## Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE STRUCTURE                           │
└─────────────────────────────────────────────────────────────────┘

notifications table
├── id (UUID)
├── user_id (UUID) → profiles.id
├── type (TEXT) → 'proposal', 'approval', 'rejection', etc.
├── title (TEXT) → "New Event Proposal"
├── message (TEXT) → "New event 'Tech Fest' proposed..."
├── link (TEXT) → "/dashboard/proposals"
├── read (BOOLEAN) → false
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

Triggers on events table:
├── trigger_notify_heads_on_proposal
│   └── Fires: AFTER INSERT
│   └── When: status = 'pending_head_approval'
│
├── trigger_notify_ec_on_head_approval
│   └── Fires: AFTER UPDATE
│   └── When: status changes to 'pending_ec_approval'
│
├── trigger_notify_proposer_on_status_change
│   └── Fires: AFTER UPDATE
│   └── When: status changes to 'active', 'rejected_by_head', 'cancelled'
│
└── trigger_notify_on_ec_revoke
    └── Fires: AFTER UPDATE
    └── When: status changes from 'rejected_by_head' to 'pending_ec_approval'
```

## User Interface Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT HIERARCHY                          │
└─────────────────────────────────────────────────────────────────┘

app/dashboard/page.tsx (Server Component)
    │
    └─→ DashboardNav (Client Component)
            │
            ├─→ DynamicLogo
            ├─→ NotificationBell (Client Component)
            │       │
            │       ├─→ Bell Icon with Badge
            │       ├─→ Dropdown Menu
            │       │   ├─→ Notification Items
            │       │   ├─→ Mark as Read Button
            │       │   ├─→ Delete Button
            │       │   └─→ View All Link
            │       │
            │       └─→ Supabase Realtime Subscription
            │
            ├─→ Profile Link
            └─→ Logout Button

app/dashboard/notifications/page.tsx (Client Component)
    │
    ├─→ Filter Dropdown (All / Unread)
    ├─→ Mark All Read Button
    ├─→ Delete Read Button
    ├─→ Notification List
    │   └─→ Notification Cards
    │       ├─→ Icon
    │       ├─→ Title
    │       ├─→ Message
    │       ├─→ Timestamp
    │       ├─→ Mark Read Button
    │       └─→ Delete Button
    │
    └─→ Supabase Realtime Subscription
```

## Notification States

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION STATES                          │
└─────────────────────────────────────────────────────────────────┘

UNREAD (read = false)
├── Visual: Blue left border, bold text, "NEW" badge
├── Badge: Counted in bell icon badge
├── Actions: Click to mark read & navigate
└── Dropdown: Shows at top

READ (read = true)
├── Visual: Normal text, no border, no badge
├── Badge: Not counted
├── Actions: Click to navigate, can delete
└── Dropdown: Shows below unread

DELETED
├── Removed from database
├── No longer visible
└── Cannot be recovered
```

## Performance Optimizations

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATIONS                                │
└─────────────────────────────────────────────────────────────────┘

Database Indexes:
├── idx_notifications_user_id → Fast user lookup
├── idx_notifications_read → Fast unread filtering
├── idx_notifications_created_at → Fast sorting
└── idx_notifications_type → Fast type filtering

Query Limits:
├── Bell Dropdown: 20 most recent
├── Notifications Page: All (with pagination ready)
└── Real-time: Only user's own notifications

Caching:
├── Unread count cached in component state
├── Notification list cached in component state
└── Real-time updates invalidate cache

Real-time:
├── WebSocket connection (efficient)
├── Only subscribes to user's notifications
└── Automatic reconnection on disconnect
```

## 🎯 Summary

The notification system provides:
- ✅ Real-time updates without page refresh
- ✅ Automatic notifications for all workflow events
- ✅ Clean, intuitive UI with bell icon
- ✅ Full notifications page for history
- ✅ Mark as read / Delete functionality
- ✅ Type-based icons and colors
- ✅ Smart time formatting
- ✅ Secure RLS policies
- ✅ Optimized database queries
- ✅ Extensible for future notification types

**Everything is ready to use!** 🚀
