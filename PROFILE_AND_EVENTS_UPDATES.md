# Profile and Events Updates Summary

## Changes Implemented

### 1. Profile Description Field ✅

**Database Migration**: `034_add_profile_description.sql`
- Added `description TEXT` column to profiles table
- Added text search index for future search features

**UI Updates**: `app/dashboard/profile/page.tsx`
- Added description/bio textarea field
- Increased profile photo size from 128px (w-32 h-32) to 192px (w-48 h-48) ≈ 5cm x 5cm
- Improved photo upload UI with larger camera button
- Added helper text explaining the description is public
- Description is saved and loaded with profile

**Features**:
- Users can add a bio/description to their profile
- Description is stored in database and can be displayed publicly
- Photo displays at approximately 5cm x 5cm (192px x 192px)
- Better visual hierarchy with larger photo and improved spacing

### 2. Heads Can Propose Events ✅

**File Updated**: `app/dashboard/propose-event/page.tsx`

**Changes**:
- Changed permission check from `co_head` only to both `head` and `co_head`
- Updated query: `.in('position', ['head', 'co_head'])`
- Updated error message: "Only committee heads and co-heads can propose events"

**Impact**:
- Committee heads can now propose events (previously only co-heads could)
- Co-heads retain their ability to propose events
- Both roles have equal access to event proposal functionality

### 3. Faculty Approval Status

**Current Status**: Events still go through faculty approval workflow

The current event workflow is:
1. Co-head/Head proposes → `pending_head_approval`
2. Head approves → `pending_faculty_approval`
3. Faculty approves → `faculty_approved` → `active`

**To Remove Faculty Approval** (Optional - Not Implemented Yet):

If you want to skip faculty approval entirely, you would need to:

1. Update event status flow in `lib/approval-workflow.ts`:
   - Change head approval to set status directly to `active` instead of `pending_faculty_approval`

2. Update RLS policies in `supabase/migrations/024_rls_policies.sql`:
   - Remove faculty approval checks

3. Update UI components:
   - Remove faculty approval sections from dashboards
   - Update event cards to not show "Pending Faculty Approval" status

**Would you like me to implement the faculty approval removal?**

## How to Apply These Changes

### Step 1: Run Database Migration

Run this in Supabase SQL Editor:

```sql
-- Add description column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for text search
CREATE INDEX IF NOT EXISTS idx_profiles_description 
ON profiles USING gin(to_tsvector('english', description))
WHERE description IS NOT NULL;

-- Comment
COMMENT ON COLUMN profiles.description IS 'User bio/description shown on profile page';
```

### Step 2: Test Profile Updates

1. Go to `/dashboard/profile`
2. You should see:
   - Larger profile photo (192px x 192px ≈ 5cm)
   - New "Description / Bio" textarea field
   - Helper text: "This will be shown on your public profile"
3. Add a description and save
4. Verify it saves correctly

### Step 3: Test Event Proposals

1. Login as a committee head (not just co-head)
2. Go to `/dashboard/propose-event`
3. You should be able to propose an event
4. Previously only co-heads could do this

## Database Schema Changes

### profiles table (NEW COLUMN)

```sql
description TEXT  -- User bio/description
```

### No changes to events table
- Event workflow remains the same
- Faculty approval still required (unless you want to remove it)

## UI Improvements

### Profile Page
- Photo size: 128px → 192px (5cm x 5cm)
- Added description textarea (4 rows)
- Better visual hierarchy
- Improved camera button styling

### Propose Event Page
- Permission check now includes heads
- Updated error messages
- No visual changes

## Next Steps (Optional)

If you want to remove faculty approval entirely:

1. **Simplify Event Workflow**:
   - Head approval → directly to `active` status
   - Skip `pending_faculty_approval` and `faculty_approved` states

2. **Update Approval Functions**:
   - Modify `approveEventAsHead()` in `lib/approval-workflow.ts`
   - Set status to `active` instead of `pending_faculty_approval`

3. **Clean Up UI**:
   - Remove faculty dashboard approval sections
   - Update event status displays
   - Remove faculty-specific filters

Would you like me to implement the faculty approval removal?

## Files Modified

1. `supabase/migrations/034_add_profile_description.sql` (NEW)
2. `app/dashboard/profile/page.tsx` (UPDATED)
3. `app/dashboard/propose-event/page.tsx` (UPDATED)

## Testing Checklist

- [ ] Run migration 034 in Supabase
- [ ] Test profile page loads correctly
- [ ] Test adding/editing description
- [ ] Test profile photo upload (should be larger)
- [ ] Test heads can propose events
- [ ] Test co-heads can still propose events
- [ ] Test regular members cannot propose events
