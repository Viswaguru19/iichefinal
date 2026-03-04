# Fix: Committee Heads and Co-Heads Can Now View Proposals ✅

## Problem
Committee heads and co-heads could not view event proposals that were pending their approval. The issue was that the code was only checking for `position = 'head'` but not including `'co_head'`.

## Root Cause
Two pages had hardcoded checks that excluded co-heads:

1. **`app/dashboard/events/workflow/page.tsx`**
   - Line checking membership: `.eq('position', 'head')`
   - Should be: `.in('position', ['head', 'co_head'])`

2. **`app/dashboard/proposals/page.tsx`**
   - Line checking if user is head: `m.position === 'head'`
   - Should be: `m.position === 'head' || m.position === 'co_head'`
   - Line checking approval permission: `m.position === 'head'`
   - Should include committee_id check for proper scoping

## Solution

### 1. Event Workflow Page (`app/dashboard/events/workflow/page.tsx`)

**Before:**
```typescript
const { data: membership } = await supabase
  .from('committee_members')
  .select('committee_id, position')
  .eq('user_id', user.id)
  .eq('position', 'head')  // ❌ Only heads
  .single();
```

**After:**
```typescript
const { data: membership } = await supabase
  .from('committee_members')
  .select('committee_id, position')
  .eq('user_id', user.id)
  .in('position', ['head', 'co_head'])  // ✅ Both heads and co-heads
  .single();
```

### 2. Proposals Page (`app/dashboard/proposals/page.tsx`)

**Before:**
```typescript
const isHead = (profile as any)?.committee_members?.some((m: any) => 
  m.position === 'head'  // ❌ Only heads
);

const canApproveAsHead = (proposal: any) => {
  return userCommittees.includes(proposal.committee_id) &&
    userProfile?.committee_members?.some((m: any) => 
      m.position === 'head'  // ❌ Only heads, no committee check
    ) &&
    proposal.status === 'pending_head_approval';
};
```

**After:**
```typescript
const isHead = (profile as any)?.committee_members?.some((m: any) => 
  m.position === 'head' || m.position === 'co_head'  // ✅ Both
);

const canApproveAsHead = (proposal: any) => {
  return userCommittees.includes(proposal.committee_id) &&
    userProfile?.committee_members?.some((m: any) => 
      (m.position === 'head' || m.position === 'co_head') &&  // ✅ Both
      m.committee_id === proposal.committee_id  // ✅ Proper scoping
    ) &&
    proposal.status === 'pending_head_approval';
};
```

## What This Fixes

### For Committee Heads
- ✅ Can now view proposals from their committee
- ✅ Can approve proposals at `pending_head_approval` status
- ✅ Proposals show up in `/dashboard/events/workflow`
- ✅ Proposals show up in `/dashboard/proposals`

### For Committee Co-Heads
- ✅ Can now view proposals from their committee (previously couldn't)
- ✅ Can approve proposals at `pending_head_approval` status (previously couldn't)
- ✅ Proposals show up in `/dashboard/events/workflow` (previously didn't)
- ✅ Proposals show up in `/dashboard/proposals` (previously didn't)

## Testing

### Test as Committee Head
1. Log in as a committee head
2. Go to `/dashboard/events/workflow`
3. Should see events from your committee at `pending_head_approval`
4. Should be able to approve or reject

### Test as Committee Co-Head
1. Log in as a committee co-head
2. Go to `/dashboard/events/workflow`
3. Should see events from your committee at `pending_head_approval`
4. Should be able to approve or reject

### Verify with SQL
```sql
-- Check who is head or co-head
SELECT 
    p.name,
    p.email,
    cm.position,
    c.name as committee
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
WHERE cm.position IN ('head', 'co_head')
ORDER BY c.name, cm.position;

-- Check events pending head approval
SELECT 
    e.id,
    e.title,
    e.status,
    c.name as committee,
    proposer.name as proposed_by
FROM events e
JOIN committees c ON e.committee_id = c.id
LEFT JOIN profiles proposer ON e.proposed_by = proposer.id
WHERE e.status = 'pending_head_approval';
```

## Files Modified
1. ✅ `app/dashboard/events/workflow/page.tsx`
2. ✅ `app/dashboard/proposals/page.tsx`

## Status: FIXED ✅

Both committee heads and co-heads can now view and approve proposals from their committees.
