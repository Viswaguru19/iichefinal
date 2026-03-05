# Enhanced Approval Workflow - Implementation Plan

## Overview
Implementing full enhanced workflow with review, edit, reject, and revoke capabilities.

## Phase 1: Database Setup ✅ READY

**File**: `IMPLEMENT_ENHANCED_WORKFLOW.sql`

**What it does**:
- Adds `rejected_by_head` and `pending_ec_approval` enum values
- Adds columns for rejection tracking
- Adds edit history tracking
- Updates RLS policies
- Creates necessary indexes

**Action**: Run this SQL file in Supabase SQL Editor NOW

## Phase 2: UI Components (To Implement)

### Component 1: EditEventModal
**Location**: `components/proposals/EditEventModal.tsx`
**Purpose**: Allow heads to review and edit event details before approval
**Features**:
- Pre-filled form with current event data
- All fields editable (title, description, date, location, budget)
- Edit notes field
- Save & Send to EC button
- Tracks changes in edit_history

### Component 2: RejectModal
**Location**: `components/proposals/RejectModal.tsx`
**Purpose**: Allow heads to reject with reason
**Features**:
- Rejection reason textarea (required)
- Confirm/Cancel buttons
- Sets status to `rejected_by_head`

### Component 3: RevokeModal
**Location**: `components/proposals/RevokeModal.tsx`
**Purpose**: Allow EC to revoke head rejections
**Features**:
- Shows original rejection reason
- Revoke reason textarea (required)
- Confirm/Cancel buttons
- Sets status to `pending_ec_approval`

### Component 4: EditHistoryView
**Location**: `components/proposals/EditHistoryView.tsx`
**Purpose**: Display audit trail of all changes
**Features**:
- Timeline view of all edits
- Shows who made changes and when
- Shows what was changed (before/after)
- Shows rejection/revoke reasons

## Phase 3: Update Proposals Page

### Changes to `app/dashboard/proposals/page.tsx`:

1. **Add state for modals**:
```typescript
const [showEditModal, setShowEditModal] = useState(false);
const [showRejectModal, setShowRejectModal] = useState(false);
const [showRevokeModal, setShowRevokeModal] = useState(false);
const [selectedEvent, setSelectedEvent] = useState<any>(null);
```

2. **Add handler functions**:
```typescript
async function handleEdit(event: any) {
  setSelectedEvent(event);
  setShowEditModal(true);
}

async function handleReject(event: any, reason: string) {
  // Update event status to rejected_by_head
  // Save rejection reason
  // Reload proposals
}

async function handleRevoke(event: any, reason: string) {
  // Update event status to pending_ec_approval
  // Save revoke reason
  // Reload proposals
}

async function handleAcceptRejection(event: any) {
  // Update event status to cancelled
  // Reload proposals
}
```

3. **Update button rendering logic**:
```typescript
// For Committee Heads viewing pending_head_approval
{canApproveAsHead(proposal) && (
  <>
    <button onClick={() => handleEdit(proposal)}>
      Review & Edit
    </button>
    <button onClick={() => handleHeadApprove(proposal.id)}>
      Approve & Send to EC
    </button>
    <button onClick={() => {
      setSelectedProposal(proposal);
      setShowRejectModal(true);
    }}>
      Reject
    </button>
  </>
)}

// For EC viewing rejected_by_head
{proposal.status === 'rejected_by_head' && canApproveAsEC(proposal) && (
  <>
    <div className="rejection-notice">
      ⚠️ Rejected by Head: {proposal.head_rejection_reason}
    </div>
    <button onClick={() => handleAcceptRejection(proposal)}>
      Accept Rejection
    </button>
    <button onClick={() => {
      setSelectedProposal(proposal);
      setShowRevokeModal(true);
    }}>
      Revoke & Review
    </button>
  </>
)}
```

## Phase 4: Implementation Steps

### Step 1: Run Database Setup (DO THIS FIRST)
```bash
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy IMPLEMENT_ENHANCED_WORKFLOW.sql
4. Click "Run"
5. Verify success message
```

### Step 2: Create Modal Components (30 min)
- Create EditEventModal.tsx
- Create RejectModal.tsx
- Create RevokeModal.tsx

### Step 3: Update Proposals Page (45 min)
- Add modal state management
- Add handler functions
- Update button rendering
- Add rejection display

### Step 4: Add Edit History View (30 min)
- Create EditHistoryView component
- Add to proposal detail view
- Format timeline display

### Step 5: Testing (30 min)
- Test head edit flow
- Test head reject flow
- Test EC revoke flow
- Test EC accept rejection flow
- Verify audit trail

## Total Estimated Time: 3-4 hours

## Quick Start

1. **NOW**: Run `IMPLEMENT_ENHANCED_WORKFLOW.sql`
2. **Next**: I'll create the modal components
3. **Then**: Update proposals page
4. **Finally**: Test everything

## File Structure

```
components/
  proposals/
    EditEventModal.tsx       (NEW)
    RejectModal.tsx          (NEW)
    RevokeModal.tsx          (NEW)
    EditHistoryView.tsx      (NEW)

app/
  dashboard/
    proposals/
      page.tsx               (UPDATE)
```

## Database Schema After Implementation

```sql
events table:
  - status: event_status (includes rejected_by_head)
  - head_rejection_reason: TEXT
  - head_rejected_at: TIMESTAMPTZ
  - ec_revoke_reason: TEXT
  - ec_revoked_by: UUID
  - ec_revoked_at: TIMESTAMPTZ
  - edit_history: JSONB
  - last_edited_by: UUID
  - last_edited_at: TIMESTAMPTZ
```

## Workflow Diagram

```
Proposal Created
      ↓
pending_head_approval
      ↓
   [HEAD REVIEWS]
      ↓
   ┌──────┴──────┐
   ↓             ↓
[EDIT]      [APPROVE]    [REJECT]
   ↓             ↓             ↓
pending_ec  pending_ec   rejected_by_head
approval    approval          ↓
   ↓             ↓        [EC REVIEWS]
   └──────┬──────┘            ↓
          ↓              ┌────┴────┐
   [EC APPROVES]         ↓         ↓
          ↓          [REVOKE]  [ACCEPT]
pending_faculty         ↓         ↓
approval           pending_ec  cancelled
          ↓          approval
   [FACULTY APPROVES]   ↓
          ↓         [EC APPROVES]
       active            ↓
                   pending_faculty
                   approval
                         ↓
                      active
```

## Ready to Proceed?

Run `IMPLEMENT_ENHANCED_WORKFLOW.sql` now, then I'll create all the components!
