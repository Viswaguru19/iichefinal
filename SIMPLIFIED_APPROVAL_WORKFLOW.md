# Simplified Event Approval Workflow

## Current Problem

Events are not showing up for committee heads and EC members for approval. The workflow has too many steps.

## Desired Workflow

1. **Member proposes event** → Status: `pending_committee_head`
   - Visible to: Committee head of that committee
   
2. **Committee Head approves** → Status: `pending_ec`
   - Visible to: All EC members
   - Requires: 1 EC approval (not 2)
   
3. **EC approves** → Status: `approved`
   - Event moves to Event Progress
   - Tasks can be created

## Changes Needed

### 1. Update Event Statuses

Current statuses:
- `pending_head_approval` → `pending_ec_approval` → `pending_faculty_approval` → `active`

New statuses:
- `pending_committee_head` → `pending_ec` → `approved`

### 2. Remove Faculty Approval Step

Faculty approval is removed from the workflow. Events go directly from EC approval to approved status.

### 3. Lower EC Threshold

Change from 2 EC approvals to 1 EC approval for faster processing.

## Implementation

Run the SQL migration `041_simplify_approval_workflow.sql` to:
1. Update existing event statuses
2. Modify approval workflow functions
3. Update RLS policies

Then update the frontend pages to show correct approval stages.
