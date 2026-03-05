# Task Approval Workflow - Complete Implementation

## Overview
EC members can now approve tasks assigned by committee members directly from the Event Detail page. Once approved, tasks appear in the Event Progress dashboard and are visible to the assigned committee.

## Workflow Steps

### 1. Committee Member Proposes Task
- Committee members assign tasks to other committees from the Tasks page
- Task is created with status: `pending_ec_approval`
- Task is NOT visible in Event Progress until approved
- Notification sent to EC members (if notification system is active)

### 2. EC Member Reviews Task
EC members can review pending tasks in two places:

#### Option A: Event Progress Page
- Navigate to `/dashboard/events/progress`
- Select an event
- If there are pending tasks, a yellow button appears: "X Tasks Awaiting Approval"
- Click the button to go to Event Detail page

#### Option B: Event Detail Page
- Navigate to `/dashboard/event-detail/[event-id]`
- Pending tasks appear in a highlighted yellow section at the top
- Shows: Task title, description, assigned committee, proposer

### 3. EC Approval Actions
EC members have two options:

#### Approve As-Is
1. Click "Approve Task" button
2. Task status changes to `approved`
3. Task becomes visible in Event Progress
4. Notifications sent to all members of assigned committee
5. Committee can now start working on the task

#### Edit & Approve
1. Click "Edit & Approve" button
2. Edit task title and/or description
3. Click "Save & Approve"
4. Modified task is approved and assigned
5. Notifications sent to assigned committee

### 4. Task Appears in Progress
Once approved:
- Task shows in Event Progress page with "✓ EC Approved" badge
- Task appears in committee's Tasks section
- Task is included in event progress calculations
- Committee members can update progress and mark complete

## Database Schema

### task_assignments Table
```sql
- id: UUID (primary key)
- event_id: UUID (references events)
- assigned_to_committee: UUID (committee receiving task)
- assigned_by_committee: UUID (committee that created task)
- assigned_by_user: UUID (user who created task)
- title: TEXT
- description: TEXT
- status: TEXT (pending_ec_approval, approved, in_progress, completed, rejected)
- ec_approved_by: UUID (EC member who approved)
- ec_approved_at: TIMESTAMP
- progress: INTEGER (0-100)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Key Features

### 1. Visual Indicators
- **Yellow highlight**: Pending EC approval tasks
- **Green badge**: EC approved tasks
- **Progress bar**: Shows task completion percentage
- **Animated button**: Pulsing "Awaiting Approval" button on Event Progress

### 2. Notifications
When task is approved:
- All members of assigned committee receive notification
- Notification includes: task title, event name, link to Tasks page
- Type: `task_assigned`

### 3. Progress Calculation
- Only approved tasks count toward event progress
- Pending tasks are excluded from progress bar
- Progress bar shows: Not Started, In Progress, Completed

### 4. Access Control
- Only EC members can approve tasks
- Committee members can view their assigned tasks
- Task creators can see pending status

## User Interface

### Event Detail Page - Pending Tasks Section
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Tasks Awaiting EC Approval (2)                   │
│                                                      │
│ These tasks have been proposed by committee         │
│ members and are waiting for your approval.          │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ Design Event Poster          [PENDING APPROVAL]│  │
│ │ Assigned to: Graphics Committee               │   │
│ │ Proposed by: John Doe (Cultural Committee)    │   │
│ │                                                │   │
│ │ Create an attractive poster for the event...  │   │
│ │                                                │   │
│ │ [Approve Task]  [Edit & Approve]              │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Event Progress Page - Approved Tasks
```
┌─────────────────────────────────────────────────────┐
│ Event Progress                                       │
│                                                      │
│ [2 Tasks Awaiting Approval] ← Click to review       │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ Design Event Poster    [✓ EC APPROVED]       │   │
│ │ Graphics Committee                            │   │
│ │ Approved by Jane Smith on Jan 15, 2024        │   │
│ │                                                │   │
│ │ Progress: ████████░░ 80%                      │   │
│ │                                                │   │
│ │ [IN PROGRESS]                                 │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Files Modified

### 1. app/dashboard/event-detail/[id]/page.tsx
- Updated `loadEventDetails()` to load from `task_assignments` table
- Enhanced `approveTask()` with notification system
- Enhanced `editAndApproveTask()` with modifications support
- Added `sendTaskApprovalNotification()` function
- Improved UI with pending tasks section
- Added progress calculation excluding pending tasks

### 2. app/dashboard/events/progress/page.tsx
- Added pending task count display
- Added "Awaiting Approval" button for EC members
- Updated task filtering to exclude pending tasks from progress
- Added "Review" button for pending tasks
- Enhanced task status indicators

### 3. app/dashboard/tasks/page.tsx
- Already supports task creation with `pending_ec_approval` status
- Already has EC approval functionality
- Integrated with notification system

## Testing Checklist

### As Committee Member
- [ ] Create a task and assign to another committee
- [ ] Verify task shows as "Pending EC Approval"
- [ ] Verify task does NOT appear in Event Progress
- [ ] Verify task appears in your Tasks list

### As EC Member
- [ ] Navigate to Event Progress page
- [ ] Verify "X Tasks Awaiting Approval" button appears
- [ ] Click button to go to Event Detail page
- [ ] Verify pending tasks section is visible
- [ ] Approve a task as-is
- [ ] Verify task appears in Event Progress
- [ ] Edit and approve another task
- [ ] Verify modifications are saved

### As Assigned Committee Member
- [ ] Receive notification when task is approved
- [ ] View task in Tasks section
- [ ] Update task progress
- [ ] Mark task as complete
- [ ] Verify progress updates in Event Progress

## Notification Flow

```
Committee Member Creates Task
         ↓
Task Status: pending_ec_approval
         ↓
EC Member Approves Task
         ↓
Task Status: approved
         ↓
Notifications Sent to Assigned Committee
         ↓
Committee Members See Task in Tasks Section
         ↓
Committee Updates Progress
         ↓
Progress Shows in Event Progress Dashboard
```

## Status Transitions

```
pending_ec_approval → approved → in_progress → completed
                   ↘ rejected
```

## Benefits

1. **Oversight**: EC maintains control over task assignments
2. **Flexibility**: EC can modify tasks before approval
3. **Transparency**: Clear approval status for all users
4. **Efficiency**: Quick approval process with edit capability
5. **Notifications**: Automatic alerts to assigned committees
6. **Progress Tracking**: Only approved tasks count toward progress

## Future Enhancements

1. Bulk approve multiple tasks
2. Task rejection with reason
3. Task reassignment by EC
4. Task priority levels
5. Task deadline enforcement
6. Task dependency management
7. Email notifications for task approvals
8. Task approval history/audit log

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify user has EC role (executive_role field set)
3. Verify task_assignments table exists
4. Check RLS policies allow EC members to update tasks
5. Verify notifications table exists and is accessible
