# Form Responses Access Control - Fixed

## Issue
Form responses should only be viewable by portal users (admins, committee members, EC members, faculty), not by regular students who fill out forms.

## Solution Implemented

### 1. Database RLS Policies (SQL)
**File**: `FIX_FORM_RESPONSES_ACCESS.sql`

Updated RLS policies to restrict access:

#### Who Can View Responses:
- ✅ Admins (`is_admin = true`)
- ✅ Faculty (`is_faculty = true`)
- ✅ EC Members (`executive_role IS NOT NULL`)
- ✅ Committee Members (any position)
- ✅ Form Creators (who created the form)

#### Who Cannot View Responses:
- ❌ Regular students (who only fill forms)
- ❌ Unauthenticated users

### 2. Frontend Access Control
**File**: `app/dashboard/forms/[id]/responses/page.tsx`

Updated the access check to verify user permissions before showing responses.

## Changes Made

### Database Policies

```sql
-- Policy 1: Anyone can submit responses
CREATE POLICY "Anyone can submit form responses" ON form_responses 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Portal users can view all responses
CREATE POLICY "Portal users can view responses" ON form_responses 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (
        is_admin = true 
        OR is_faculty = true 
        OR executive_role IS NOT NULL
        OR id IN (SELECT user_id FROM committee_members)
      )
    )
  );

-- Policy 3: Form creators can view their form's responses
CREATE POLICY "Form creators can view responses" ON form_responses 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_responses.form_id 
      AND forms.created_by = auth.uid()
    )
  );

-- Policy 4: Admins can delete responses
CREATE POLICY "Admins can delete responses" ON form_responses 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );
```

### Frontend Access Check

```typescript
// Check if user has permission to view responses
const hasAccess =
  profile?.is_admin === true ||
  profile?.is_faculty === true ||
  profile?.executive_role !== null ||
  (profile?.committee_members && profile.committee_members.length > 0);

if (!hasAccess) {
  // Show "Access Denied" message
  return <AccessDenied />;
}
```

## How It Works

### For Regular Students (Form Fillers)
1. Student opens form link
2. Fills out form
3. Submits response ✅
4. Tries to view responses page
5. Gets "Access Denied" message ❌

### For Portal Users
1. Portal user (admin/committee member/EC/faculty) logs in
2. Navigates to Forms section
3. Clicks on a form
4. Clicks "View Responses"
5. Can see all responses ✅
6. Can export/analyze data ✅

## Testing

### Test as Regular Student
1. Create a test student account (no committee membership)
2. Fill out a form
3. Try to access `/dashboard/forms/[id]/responses`
4. Should see "Access Denied" message

### Test as Portal User
1. Login as admin/committee member/EC member
2. Navigate to Forms
3. Click "View Responses" on any form
4. Should see all responses

### Test as Form Creator
1. Create a form as a committee member
2. View responses for that form
3. Should see all responses

## SQL Migration Required

Run this SQL in Supabase SQL Editor:

**File**: `FIX_FORM_RESPONSES_ACCESS.sql`

This will:
1. Drop old policies
2. Create new restrictive policies
3. Verify the changes

## Files Modified

1. ✅ `FIX_FORM_RESPONSES_ACCESS.sql` (NEW)
   - Database RLS policies
   - Access control at database level

2. ✅ `app/dashboard/forms/[id]/responses/page.tsx`
   - Frontend access check
   - Updated to check all portal user types
   - Load fields from JSONB

## Security Benefits

### Database Level (RLS)
- Even if someone bypasses frontend, database blocks access
- Policies are enforced on all queries
- No way to access data without proper permissions

### Frontend Level
- Shows appropriate UI based on permissions
- Prevents unnecessary API calls
- Better user experience

## Access Matrix

| User Type | Submit Form | View Responses | Delete Responses |
|-----------|-------------|----------------|------------------|
| Regular Student | ✅ | ❌ | ❌ |
| Committee Member | ✅ | ✅ | ❌ |
| Committee Head | ✅ | ✅ | ❌ |
| EC Member | ✅ | ✅ | ❌ |
| Faculty | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ |
| Form Creator | ✅ | ✅ | ❌ |
| Unauthenticated | ❌ | ❌ | ❌ |

## Status

✅ Database policies - Ready to apply
✅ Frontend access control - Fixed
✅ JSONB fields support - Fixed
✅ No TypeScript errors
✅ Ready to test

## Next Steps

1. **Run the SQL migration**: `FIX_FORM_RESPONSES_ACCESS.sql`
2. **Test with different user types**
3. **Verify regular students cannot view responses**
4. **Verify portal users can view responses**

## Support

If regular students can still view responses:
1. Verify SQL migration ran successfully
2. Check RLS is enabled: `ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;`
3. Check user's profile has correct fields set
4. Clear browser cache and re-login
