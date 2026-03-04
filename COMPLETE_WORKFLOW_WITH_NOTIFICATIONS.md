# Complete Event & Task Approval Workflow with Notifications ✅

## Overview
This document describes the complete workflow for event proposals, approvals, task assignments, and notifications.

---

## EVENT APPROVAL WORKFLOW

### Step 1: Member Proposes Event
**Action**: Committee head or co-head submits event proposal

**Status**: `pending_head_approval`

**Visible to**:
- Committee head (can approve/reject)
- EC members (read-only view)

**Page**: `/dashboard/propose-event`

---

### Step 2: Committee Head Approves
**Action**: Committee head reviews and approves the event

**Status Change**: `pending_head_approval` → `pending_ec_approval`

**Visible to**:
- All EC members (can approve/reject)
- Committee head (read-only)

**Page**: `/dashboard/events/workflow`

---

### Step 3: EC Member Approves
**Action**: Any 1 EC member approves the event

**Status Change**: `pending_ec_approval` → `approved`

**Notification Sent**: 
- ✅ **To**: User who proposed the event
- ✅ **Type**: `event_approved`
- ✅ **Title**: "Event Approved! 🎉"
- ✅ **Message**: "Your event '[Event Title]' has been approved by the Executive Committee and is now active. You can start assigning tasks in Event Progress."
- ✅ **Link**: `/dashboard/events/progress`

**Visible to**:
- Everyone in Event Progress page

**Page**: `/dashboard/events/workflow`

---

## TASK ASSIGNMENT & APPROVAL WORKFLOW

### Step 4: EC Assigns Tasks to Committees
**Action**: EC member creates tasks and assigns them to committees

**Status**: `pending_ec_approval`

**Visible to**:
- EC members only (can approve/reject)
- Assigned committee members (hidden until approved)

**Page**: `/dashboard/events/progress` or `/dashboard/tasks`

**Note**: Tasks are created with `pending_ec_approval` status and require EC approval before being visible to committee members.

---

### Step 5: EC Approves Task
**Action**: Any 1 EC member approves the task assignment

**Status Change**: `pending_ec_approval` → `not_started`

**Notifications Sent**:
- ✅ **To**: ALL members of the assigned committee
- ✅ **Type**: `task_assigned`
- ✅ **Title**: "New Task Assigned! 📋"
- ✅ **Message**: "Your committee '[Committee Name]' has been assigned a new task: '[Task Title]' for the event '[Event Name]'. Check your tasks section for details."
- ✅ **Link**: `/dashboard/tasks`

**Visible to**:
- All members of the assigned committee
- EC members
- Admins

**Page**: `/dashboard/events/progress` or `/dashboard/tasks`

---

### Step 6: Committee Members Work on Task
**Action**: Committee members update task status and post progress updates

**Status Progression**: `not_started` → `in_progress` → `partially_completed` → `completed`

**Visible to**:
- All members of the assigned committee
- EC members
- Admins

**Page**: `/dashboard/tasks`

---

## NOTIFICATION SYSTEM

### Event Approval Notification
```typescript
{
  user_id: proposer_id,
  type: 'event_approved',
  title: 'Event Approved! 🎉',
  message: 'Your event "[Event Title]" has been approved...',
  link: '/dashboard/events/progress',
  metadata: {
    event_id: event_id,
    committee_id: committee_id
  }
}
```

### Task Assignment Notification
```typescript
{
  user_id: committee_member_id,
  type: 'task_assigned',
  title: 'New Task Assigned! 📋',
  message: 'Your committee "[Committee Name]" has been assigned...',
  link: '/dashboard/tasks',
  metadata: {
    task_id: task_id,
    event_id: event_id,
    committee_id: committee_id
  }
}
```

---

## VISIBILITY RULES

### Events

| Status | Committee Head | EC Members | Regular Members |
|--------|---------------|------------|-----------------|
| `pending_head_approval` | Can approve/reject (own committee only) | Read-only view (all events) | Hidden |
| `pending_ec_approval` | Read-only view | Can approve/reject (all events) | Hidden |
| `approved` | View in Event Progress | View in Event Progress | View in Event Progress |

### Tasks

| Status | EC Members | Assigned Committee | Other Committees |
|--------|-----------|-------------------|------------------|
| `pending_ec_approval` | Can approve/reject | Hidden | Hidden |
| `not_started` | View & manage | View & update | Hidden |
| `in_progress` | View & manage | View & update | Hidden |
| `completed` | View | View | Hidden |

---

## USER ROLES & PERMISSIONS

### Committee Head
- Propose events for their committee
- Approve/reject events from their committee at `pending_head_approval`
- View approved events in Event Progress
- View and update tasks assigned to their committee

### EC Member (Executive Committee)
- View all events at any status
- Approve/reject events at `pending_ec_approval`
- Assign tasks to any committee
- Approve/reject tasks at `pending_ec_approval`
- View all tasks across all committees

### Committee Member (Regular)
- Propose events (if head or co-head)
- View approved events in Event Progress
- View tasks assigned to their committee (after EC approval)
- Update task status and post progress updates
- Receive notifications for:
  - Event approvals (if they proposed)
  - Task assignments (if their committee is assigned)

### Admin
- Full access to everything
- Can override any restrictions

---

## KEY PAGES

| Page | URL | Purpose |
|------|-----|---------|
| Propose Event | `/dashboard/propose-event` | Submit new event proposal |
| Event Workflow | `/dashboard/events/workflow` | Approve/reject events (heads & EC) |
| Event Progress | `/dashboard/events/progress` | View approved events & assign tasks |
| Tasks | `/dashboard/tasks` | View & manage tasks |
| Dashboard | `/dashboard` | Overview with pending approvals |

---

## DATABASE TABLES

### `events`
- `status`: Current approval status
- `proposed_by`: User who proposed
- `committee_id`: Owning committee
- `head_approved_by`: Committee head who approved
- `head_approved_at`: Timestamp

### `tasks`
- `status`: Current task status
- `event_id`: Associated event
- `assigned_to_committee_id`: Which committee is assigned
- `created_by`: Who created the task
- `ec_approved_by`: EC member who approved
- `ec_approved_at`: Timestamp

### `notifications`
- `user_id`: Recipient
- `type`: Notification type
- `title`: Notification title
- `message`: Notification message
- `link`: Where to navigate
- `read`: Boolean (read/unread)
- `metadata`: Additional data (JSON)

### `ec_approvals`
- `event_id`: Which event
- `user_id`: Which EC member
- `approved`: Boolean
- `approved_at`: Timestamp

---

## WORKFLOW SUMMARY

```
1. Member proposes event
   ↓
2. Committee head approves
   ↓
3. EC member approves
   ↓
4. ✅ NOTIFICATION sent to proposer
   ↓
5. Event shows in Event Progress
   ↓
6. EC assigns tasks to committees
   ↓
7. EC approves task
   ↓
8. ✅ NOTIFICATIONS sent to all committee members
   ↓
9. Committee members see task in their Tasks section
   ↓
10. Committee members work on task and post updates
```

---

## TESTING CHECKLIST

### Event Workflow
- [ ] Member proposes event → status = `pending_head_approval`
- [ ] Committee head sees event in workflow page
- [ ] EC members see event (read-only)
- [ ] Head approves → status = `pending_ec_approval`
- [ ] EC member approves → status = `approved`
- [ ] ✅ Proposer receives notification
- [ ] Event appears in Event Progress

### Task Workflow
- [ ] EC creates task → status = `pending_ec_approval`
- [ ] Task hidden from committee members
- [ ] EC approves task → status = `not_started`
- [ ] ✅ All committee members receive notification
- [ ] Task appears in committee members' Tasks section
- [ ] Committee members can update task status
- [ ] Committee members can post updates

### Notifications
- [ ] Event approval notification sent to proposer
- [ ] Task assignment notifications sent to all committee members
- [ ] Notifications appear in user's notification center
- [ ] Clicking notification navigates to correct page

---

## FILES MODIFIED

1. ✅ `lib/approval-workflow.ts`
   - Added `sendEventApprovalNotification()` function
   - Added `sendTaskAssignmentNotifications()` function
   - Updated `approveEventAsEC()` to send notification
   - Updated `approveTaskAsEC()` to send notifications

2. ✅ `app/dashboard/events/progress/page.tsx`
   - Tasks created with `pending_ec_approval` status
   - Added `approveTask()` function for EC members
   - Added approve button for pending tasks

3. ✅ `app/dashboard/tasks/page.tsx`
   - Updated query to hide pending tasks from regular members
   - Shows only approved tasks to committee members
   - EC members see all tasks including pending

4. ✅ `app/dashboard/events/workflow/page.tsx`
   - Complete approval interface for heads and EC
   - Shows events at correct statuses
   - Handles approvals and rejections

---

## IMPORTANT NOTES

1. **Only 1 EC approval needed** for both events and tasks
2. **Notifications are automatic** - sent when approval happens
3. **Tasks are hidden** from committee members until EC approves
4. **All committee members** receive notification when task is assigned
5. **Committee heads** can only approve events from their own committee
6. **EC members** can approve any event or task

---

## Status: READY FOR TESTING ✅

All code changes are complete. The workflow now includes:
- Event approval with notification to proposer
- Task approval with notifications to all committee members
- Proper visibility rules at each stage
- Complete audit trail in approval_logs table
