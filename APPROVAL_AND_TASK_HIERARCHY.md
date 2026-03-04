# Approval and Task Assignment Hierarchy

## Current System Overview

This document explains the approval workflow and task assignment hierarchy in the IIChE Student Chapter Portal.

## Event Approval Workflow

### 1. Event Proposal
**Who can propose**: Committee Heads and Co-Heads

**Initial Status**: `pending_head_approval`

**Process**:
- Head or Co-Head creates event proposal
- Event enters approval pipeline

### 2. Head Approval
**Who approves**: Committee Head

**Status Change**: `pending_head_approval` → `pending_faculty_approval`

**Requirements**:
- Only the committee head can approve
- Co-heads cannot approve (they can only propose)

**Implementation**: `lib/approval-workflow.ts` - `approveEventAsHead()`

### 3. Faculty Approval
**Who approves**: Faculty Advisor

**Status Change**: `pending_faculty_approval` → `faculty_approved` → `active`

**Requirements**:
- Only faculty advisors can approve
- Final approval before event becomes active

**Implementation**: `lib/approval-workflow.ts` - `approveEventAsFaculty()`

## Task Approval Workflow

### 1. Task Creation
**Who can create**: Committee members (for their committee)

**Initial Status**: `draft` or `pending_ec_approval`

**Process**:
- Task is created and linked to an event
- Automatically enters EC approval if required

### 2. EC Approval (Executive Committee)
**Who approves**: EC Members (Secretary, Joint Secretary, Treasurer, etc.)

**Status Change**: `pending_ec_approval` → `ec_approved`

**Requirements**:
- Minimum approvals needed:
  - **Events**: 2 out of 6 EC members
  - **Tasks**: 1 out of 6 EC members
- Uses upsert to prevent duplicate approvals
- Logs all approvals in `approval_logs` table

**Implementation**: `lib/approval-workflow.ts` - `approveTaskAsEC()`

**Rejection**: EC can reject with reason → `ec_rejected`

### 3. Task Assignment
**Who assigns**: Committee Head or Co-Head

**Status**: `ec_approved` → `not_started` → `in_progress`

**Process**:
- After EC approval, head/co-head assigns task to committee members
- Task moves through execution phases

## Hierarchy Summary

```
┌─────────────────────────────────────────┐
│         EVENT APPROVAL FLOW             │
└─────────────────────────────────────────┘

1. Head/Co-Head Proposes Event
   ↓
   Status: pending_head_approval
   ↓
2. Committee Head Approves
   ↓
   Status: pending_faculty_approval
   ↓
3. Faculty Advisor Approves
   ↓
   Status: faculty_approved → active


┌─────────────────────────────────────────┐
│         TASK APPROVAL FLOW              │
└─────────────────────────────────────────┘

1. Committee Member Creates Task
   ↓
   Status: pending_ec_approval
   ↓
2. EC Members Approve (1/6 required)
   ↓
   Status: ec_approved
   ↓
3. Head/Co-Head Assigns Task
   ↓
   Status: not_started → in_progress → completed
```

## Role Permissions

### Admin
- Full access to everything
- Can override any approval
- Can manage users and committees

### Faculty Advisor
- Approve events (final approval)
- View all proposals and tasks
- Cannot create events or tasks

### Executive Committee (EC)
- Approve tasks (1/6 required)
- Approve events (2/6 required)
- View all events and tasks
- Can propose events if also a head/co-head

### Committee Head
- Propose events
- Approve events for their committee
- Assign tasks
- Manage committee members

### Committee Co-Head
- Propose events
- Cannot approve events (only head can)
- Can assign tasks
- Assist head with management

### Committee Member
- Create tasks
- Update task progress
- View committee events
- Cannot approve anything

## Progress Tracking

### Event Progress
- Calculated based on completed tasks
- Only counts `ec_approved` tasks
- Excludes `pending_ec_approval` and `ec_rejected` tasks

**Formula**:
```
progress = (completed_tasks / total_ec_approved_tasks) * 100
```

### Task Status Flow
```
draft
  ↓
pending_ec_approval
  ↓
ec_approved (or ec_rejected)
  ↓
not_started
  ↓
in_progress
  ↓
partially_completed
  ↓
completed
```

## Approval Logs

All approvals are logged in the `approval_logs` table with:
- User ID and role
- Action taken
- Entity type and ID
- Previous and new status
- Reason (for rejections)
- Timestamp

This provides a complete audit trail of all approval actions.

## Key Implementation Files

1. **`lib/approval-workflow.ts`**
   - `approveEventAsHead()` - Head approves event
   - `approveEventAsFaculty()` - Faculty approves event
   - `approveTaskAsEC()` - EC approves task
   - `rejectTaskAsEC()` - EC rejects task

2. **`app/dashboard/proposals/page.tsx`**
   - Shows pending proposals
   - Allows heads to approve events
   - Shows EC approval status

3. **`app/dashboard/faculty/page.tsx`**
   - Faculty dashboard
   - Shows pending faculty approvals
   - Allows faculty to approve/reject

4. **`app/dashboard/events/workflow/page.tsx`**
   - EC workflow page
   - Shows tasks pending EC approval
   - Allows EC to approve/reject

## Verification Checklist

✅ **Event Approval**:
- [ ] Only heads/co-heads can propose events
- [ ] Only committee head can approve (not co-head)
- [ ] Faculty approval required before event becomes active
- [ ] All approvals logged

✅ **Task Approval**:
- [ ] Tasks require 1/6 EC approval
- [ ] EC can approve or reject with reason
- [ ] Approved tasks can be assigned by head/co-head
- [ ] Progress only counts EC-approved tasks

✅ **Permissions**:
- [ ] Roles enforced via RLS policies
- [ ] Unauthorized actions blocked
- [ ] Audit trail maintained

## Common Issues and Solutions

### Issue: Co-head can't approve events
**Solution**: This is correct. Only the committee head can approve events. Co-heads can only propose.

### Issue: Task shows in progress but not counted
**Solution**: Check if task is `ec_approved`. Only EC-approved tasks count toward progress.

### Issue: Event stuck in pending_head_approval
**Solution**: Committee head needs to approve. Check if user is actually the head (not co-head).

### Issue: Faculty can't see pending approvals
**Solution**: Check `is_faculty` flag in profiles table. Ensure RLS policies allow faculty access.

## Summary

The hierarchy is designed to ensure proper oversight:

1. **Proposal** → Heads/Co-Heads (initiate)
2. **Committee Approval** → Head only (first gate)
3. **Faculty Approval** → Faculty Advisor (final gate)
4. **Task Approval** → EC Members (quality control)
5. **Task Assignment** → Head/Co-Head (execution)

This creates a balanced system where:
- Ideas can come from leadership (heads/co-heads)
- Committee head validates proposals
- Faculty provides final oversight
- EC ensures task quality
- Execution is managed by committee leadership

**Is this hierarchy correct for your needs?** If you need any changes, let me know!
