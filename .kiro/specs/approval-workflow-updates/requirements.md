# Approval Workflow Updates - Requirements

## Overview
Update the event and task approval workflow to match the actual organizational requirements for IIChE AVVU portal.

## Current Issues

### Event Approval
- ❌ EC members cannot see proposals until heads approve
- ❌ All 6 EC members must approve (too strict)
- ❌ EC members cannot trigger faculty approval

### Task Approval  
- ❌ All 6 EC members must approve tasks (too strict)
- ❌ Task approval flow not clearly defined

## Requirements

### 1. Event Proposal Workflow

#### 1.1 Proposal Visibility
- **Co-head proposes** → Event created with status `pending_head_approval`
- **Heads can see and approve** the proposal
- **EC members can VIEW** proposals at `pending_head_approval` (read-only, no approval button)
- **Students cannot see** until event is `active`

#### 1.2 Head Approval
- Committee head reviews and approves
- After head approval → status becomes `pending_ec_approval`
- EC members can now see AND approve

#### 1.3 EC Approval (Updated Rule)
- **Only 2 out of 6 EC members** need to approve
- Each EC member can vote: Approve or Reject
- Once 2 approvals received → status becomes `pending_faculty_approval`
- Show approval count: "2/6 EC members approved"

#### 1.4 Faculty Approval
- Faculty can see proposals at `pending_faculty_approval`
- Faculty approves → status becomes `active`
- Event now visible to everyone
- Tasks can be assigned

### 2. Task Proposal Workflow

#### 2.1 Task Creation
- After event is `active`, proposing committee can assign tasks
- Task created with status `pending_ec_approval`
- Task includes:
  - Event name
  - Proposed by committee
  - Assigned to committee
  - Task description
  - Deadline (optional)

#### 2.2 EC Task Approval (Updated Rule)
- **Only 1 EC member** needs to approve a task
- EC member reviews and approves
- After 1 approval → status becomes `not_started`
- Task appears in assigned committee's task list

#### 2.3 Task Execution
- Assigned committee sees task in "Event Tasks"
- Can update status: `not_started` → `in_progress` → `completed`
- Can add updates and supporting documents
- When marked `completed`, checkpoint advances in Event Progress bar

### 3. Event Progress Tracking

#### 3.1 Progress Bar
- Uses only EC-approved tasks (ignores `pending_ec_approval` and `ec_rejected`)
- Shows one checkpoint per committee
- When committee's tasks reach `completed`, checkpoint turns green
- Overall progress bar advances visually

#### 3.2 Task Information Display
- Event name
- Proposed by committee
- Event date or "TBA"
- Assigned task + deadline
- Status with ability to update
- Supporting documents

## User Stories

### US-1: EC Member Views Pending Head Approval
**As an** EC member  
**I want to** see proposals that are pending head approval  
**So that** I can prepare for review once heads approve

**Acceptance Criteria:**
- EC member can see events with status `pending_head_approval`
- Approval button is disabled/hidden
- Shows "Waiting for head approval" message
- Can view all proposal details

### US-2: EC Approval with 2/6 Rule
**As an** EC member  
**I want to** approve events after head approval  
**So that** events can proceed with just 2 EC approvals

**Acceptance Criteria:**
- After head approval, EC members see "Approve" button
- Shows current approval count: "X/6 EC members approved"
- After 2 approvals, event moves to `pending_faculty_approval`
- Shows which EC members have approved

### US-3: Faculty Approves Event
**As a** faculty advisor  
**I want to** approve events after EC approval  
**So that** events can become active

**Acceptance Criteria:**
- Faculty sees events with status `pending_faculty_approval`
- Can approve or reject with reason
- After approval, status becomes `active`
- Event visible to all users

### US-4: EC Approves Task with 1/6 Rule
**As an** EC member  
**I want to** approve tasks with just 1 approval  
**So that** tasks can be assigned quickly

**Acceptance Criteria:**
- EC member sees tasks with status `pending_ec_approval`
- Can approve or request changes
- After 1 approval, task becomes `not_started`
- Task appears in assigned committee's list

### US-5: Committee Tracks Task Progress
**As a** committee member  
**I want to** update task status and add documents  
**So that** progress is tracked in Event Progress bar

**Acceptance Criteria:**
- Can change status: not_started → in_progress → completed
- Can add updates with text
- Can attach supporting documents
- Progress bar updates when task completed

## Correctness Properties

### CP-1: Approval Count Validation
**Property**: Event moves to `pending_faculty_approval` only when exactly 2 or more EC members have approved

**Test**: 
- Create event with 0 EC approvals → status should be `pending_ec_approval`
- Add 1 EC approval → status should still be `pending_ec_approval`
- Add 2nd EC approval → status should become `pending_faculty_approval`

### CP-2: Task Approval Validation
**Property**: Task moves to `not_started` only when at least 1 EC member has approved

**Test**:
- Create task with 0 EC approvals → status should be `pending_ec_approval`
- Add 1 EC approval → status should become `not_started`

### CP-3: Visibility Rules
**Property**: Users can only see events/tasks based on their role and event status

**Test**:
- EC member should see events at `pending_head_approval` (read-only)
- EC member should see events at `pending_ec_approval` (with approve button)
- Faculty should see events at `pending_faculty_approval`
- Students should only see events at `active` status

## Non-Functional Requirements

### NFR-1: Performance
- Approval count calculations should be real-time
- Progress bar should update within 1 second of task completion

### NFR-2: Usability
- Clear indication of approval status (X/6 approved)
- Disabled buttons should show tooltip explaining why
- Progress bar should be visually intuitive

### NFR-3: Security
- Only authorized users can approve at each stage
- Cannot skip approval stages
- Audit log of all approvals

## Out of Scope
- Email notifications for approvals (future enhancement)
- Approval deadline enforcement (future enhancement)
- Bulk task approval (future enhancement)

## Dependencies
- Supabase database with events and tasks tables
- EC approval tracking table (ec_approvals)
- Faculty approval fields in events table

## Success Criteria
- ✅ EC can view proposals at pending_head_approval
- ✅ Only 2 EC approvals needed for events
- ✅ Only 1 EC approval needed for tasks
- ✅ Faculty can approve from their dashboard
- ✅ Progress bar shows task-based checkpoints
- ✅ All approval counts displayed correctly
