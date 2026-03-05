# Enhanced Approval Workflow Specification

## Current Workflow Issues
- No review/edit option for heads before approval
- Rejected events disappear completely
- EC cannot override head rejections
- No way to revoke rejections

## Proposed Enhanced Workflow

### 1. Committee Head Actions
When a head sees a pending proposal, they should have these options:

**Option A: Review & Edit**
- Button: "Review & Edit"
- Opens edit modal with all event details
- Head can modify: title, description, date, location, budget
- After editing, head clicks "Send to EC" → status becomes `pending_ec_approval`

**Option B: Approve As-Is**
- Button: "Approve & Send to EC"
- No changes, directly sends to EC
- Status becomes `pending_ec_approval`

**Option C: Reject**
- Button: "Reject"
- Opens modal asking for rejection reason
- Status becomes `rejected_by_head`
- Event stays visible to EC with rejection reason

### 2. EC Actions on Rejected Events
When EC sees an event with status `rejected_by_head`, they have options:

**Option A: Neglect (Accept Rejection)**
- Button: "Accept Rejection"
- Status becomes `cancelled`
- Event is archived

**Option B: Revoke Rejection**
- Button: "Revoke & Review"
- Opens modal asking for revoke reason
- Status becomes `pending_ec_approval`
- Event proceeds to EC approval stage
- Rejection reason and revoke reason both stored for audit

### 3. New Status Values Needed

```sql
-- Add to event_status enum:
- 'pending_head_approval'     -- Initial state
- 'rejected_by_head'          -- Head rejected, EC can review
- 'pending_ec_approval'       -- Head approved or EC revoked
- 'pending_faculty_approval'  -- EC approved
- 'active'                    -- Faculty approved
- 'cancelled'                 -- Permanently rejected
```

### 4. New Database Columns Needed

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS:
- head_rejection_reason TEXT
- head_rejected_at TIMESTAMPTZ
- ec_revoke_reason TEXT
- ec_revoked_by UUID REFERENCES profiles(id)
- ec_revoked_at TIMESTAMPTZ
- edit_history JSONB DEFAULT '[]'
```

### 5. UI Changes Required

#### Proposals Page - Committee Head View
```
┌─────────────────────────────────────────┐
│ Event Title                             │
│ Description...                          │
│ Date: 2024-01-15 | Budget: ₹5000      │
│                                         │
│ [Review & Edit] [Approve & Send] [Reject]│
└─────────────────────────────────────────┘
```

#### Proposals Page - EC View (Rejected Event)
```
┌─────────────────────────────────────────┐
│ Event Title                    [REJECTED]│
│ Description...                          │
│                                         │
│ ⚠️ Rejected by Head                     │
│ Reason: Budget too high                 │
│                                         │
│ [Accept Rejection] [Revoke & Review]   │
└─────────────────────────────────────────┘
```

### 6. Edit Modal Design
```
┌──────────────────────────────────────────┐
│  Review & Edit Event Proposal            │
├──────────────────────────────────────────┤
│                                          │
│  Title: [___________________________]   │
│                                          │
│  Description:                            │
│  [_________________________________]    │
│  [_________________________________]    │
│                                          │
│  Date: [__________] Time: [_______]    │
│                                          │
│  Location: [_______________________]    │
│                                          │
│  Budget: ₹ [___________]                │
│                                          │
│  Edit Notes (optional):                  │
│  [_________________________________]    │
│                                          │
│  [Cancel]  [Save & Send to EC]          │
└──────────────────────────────────────────┘
```

### 7. Implementation Steps

#### Phase 1: Database Changes
1. Run `FIX_EVENT_STATUS_ENUM_NOW.sql` to add missing enum values
2. Add new columns for rejection/revoke tracking
3. Add edit_history JSONB column

#### Phase 2: Backend Logic
1. Create edit event function
2. Create reject with reason function
3. Create revoke rejection function
4. Update RLS policies

#### Phase 3: UI Components
1. Create EditEventModal component
2. Create RejectModal component
3. Create RevokeModal component
4. Update proposals page with new buttons

#### Phase 4: Workflow Logic
1. Implement head edit → EC approval flow
2. Implement head reject → EC review flow
3. Implement EC revoke → EC approval flow
4. Add audit trail logging

### 8. User Stories

**As a Committee Head:**
- I want to review and edit proposals before sending to EC
- I want to reject proposals that don't meet standards
- I want to provide clear rejection reasons

**As an EC Member:**
- I want to see why a head rejected a proposal
- I want to override head rejections if I disagree
- I want to accept rejections if I agree with the head

**As a Proposer:**
- I want to know if my proposal was edited
- I want to see rejection reasons
- I want to know if EC overrode a rejection

### 9. Audit Trail

Every action should be logged:
```json
{
  "edit_history": [
    {
      "action": "edited_by_head",
      "user_id": "uuid",
      "user_name": "John Doe",
      "timestamp": "2024-01-15T10:30:00Z",
      "changes": {
        "budget": {"old": 5000, "new": 3000},
        "date": {"old": "2024-02-01", "new": "2024-02-15"}
      },
      "notes": "Reduced budget to match available funds"
    },
    {
      "action": "rejected_by_head",
      "user_id": "uuid",
      "user_name": "Jane Smith",
      "timestamp": "2024-01-16T14:20:00Z",
      "reason": "Venue not available on proposed date"
    },
    {
      "action": "revoked_by_ec",
      "user_id": "uuid",
      "user_name": "Bob Johnson",
      "timestamp": "2024-01-17T09:15:00Z",
      "reason": "Alternative venue found, proceeding with approval"
    }
  ]
}
```

### 10. Benefits

1. **Flexibility**: Heads can improve proposals instead of rejecting
2. **Oversight**: EC can review all rejections
3. **Transparency**: Full audit trail of all changes
4. **Efficiency**: Fewer back-and-forth iterations
5. **Accountability**: Clear record of who did what

### 11. Complexity Assessment

This is a **LARGE** feature requiring:
- 3-4 hours of development time
- Multiple new components
- Database schema changes
- Complex state management
- Thorough testing

### 12. Simplified Alternative

If full implementation is too complex, consider:

**Minimal Version:**
1. Add "Edit" button for heads (opens propose-event page with pre-filled data)
2. Keep simple approve/reject
3. Show rejection reason to EC
4. EC can manually create new proposal if they want to override

This would take 30-60 minutes instead of 3-4 hours.

## Recommendation

Given the complexity, I recommend:
1. First fix the immediate issues (enum, RLS policies) ✅
2. Get basic approval workflow working ✅
3. Then implement enhanced features in phases

Would you like me to:
A) Implement the full enhanced workflow (3-4 hours)
B) Implement the simplified version (30-60 minutes)
C) Just document it for future implementation

Let me know which approach you prefer!
