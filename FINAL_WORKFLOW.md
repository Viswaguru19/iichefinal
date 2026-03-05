# Complete Event & Task Workflow

## Event Visibility in Event Progress

Events appear in Event Progress ONLY after EC approval:
- Event must have `status = 'active'`
- Head approval required (`head_approved_by` is set)
- Required number of EC approvals (configurable, default 2)

The SQL already handles this - events are filtered by `.eq('status', 'active')` in the Event Progress page.

## Task Assignment & Approval Workflow

### Step 1: Event Gets EC Approval
- Event is proposed
- Committee head approves
- EC members approve (required number)
- Event status changes to `active`
- **Event now appears in Event Progress**

### Step 2: Committee Members Create Tasks
- Any committee member from the event's committee can create tasks
- They assign tasks to other committees
- Task is created with `status = 'pending'`
- Task appears in Event Progress for EC to review

### Step 3: EC Members Approve Tasks
- EC members view all pending tasks in Event Progress
- They can click "Approve" on any task
- Approval sets:
  - `ec_approved_by` = EC member's ID
  - `ec_approved_at` = timestamp
  - `status` = 'approved'
- EC can also edit task details before approving

### Step 4: Committee Works on Task
- Once approved, task is visible to assigned committee
- Committee head can assign internally using `internal_assignments`
- Committee members add progress updates via `task_updates`
- Progress percentage can be updated

### Step 5: Task Completion
- When done, task is marked complete
- Sets `completed_at` timestamp
- `status` = 'completed'
- Progress bar updates

## Key Changes Made

1. **Event visibility** - Already correct, only `active` events show
2. **Task creation** - Changed from EC-only to committee members
3. **Task approval** - EC members approve in Event Progress
4. **RLS policies** - Updated to allow committee members to create tasks

## Database Tables

### task_assignments
- Stores all tasks
- `status`: 'pending', 'approved', 'in_progress', 'completed'
- `ec_approved_by`: Which EC member approved
- `assigned_by_committee`: Which committee created the task
- `assigned_to_committee`: Which committee will do the task

### task_updates
- Progress updates from committee members
- Links to `task_assignments` via `task_id`

### internal_assignments
- Committee head assigns to specific members
- Links to `task_assignments` via `task_id`

## UI Flow

1. **Event Progress Page** shows only EC-approved events
2. **Committee members** see "Assign Task" button
3. **They create tasks** for other committees
4. **EC members** see pending tasks with "Approve" button
5. **After approval**, committee can work on task
6. **Progress updates** visible to all

This matches your requirement: "anyone from the proposed committee assigns task, then in event progress EC members view task approval"
