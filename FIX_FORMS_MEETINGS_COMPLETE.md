# Forms and Meetings Schema Fix - Complete

## Issues Fixed

### 1. Forms Creation Error
**Error**: "Failed to create form"

**Root Causes**:
- Code was trying to insert `show_on_homepage` field which doesn't exist in schema
- Code was using old `form_fields` table approach instead of JSONB `fields` column
- Missing validation for empty fields

**Fix Applied**: Updated `app/dashboard/forms/create/page.tsx`
- Removed `show_on_homepage` field
- Changed to use `fields` JSONB column directly
- Added validation for empty fields
- Added validation for field labels
- Improved error messages

### 2. Meetings Creation Error
**Error**: "Could not find the 'meeting_type' column of 'meetings' in the schema cache"

**Root Cause**: 
- ENUM type `meeting_type` not created in database
- Meetings table not created with correct schema

**Fix**: Run the SQL migration `FIX_FORMS_MEETINGS_SCHEMA.sql`

## Database Schema

### Forms Table (Correct Schema)
```sql
CREATE TABLE forms (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_id UUID REFERENCES events(id),
  created_by UUID REFERENCES profiles(id),
  fields JSONB NOT NULL DEFAULT '[]',  -- Store fields as JSON
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Meetings Table (Correct Schema)
```sql
CREATE TYPE meeting_type AS ENUM ('online', 'offline');
CREATE TYPE meeting_platform AS ENUM ('microsoft_teams', 'google_meet', 'zoom', 'other');

CREATE TABLE meetings (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meeting_type meeting_type NOT NULL,  -- ENUM type
  meeting_date TIMESTAMPTZ NOT NULL,
  duration INTEGER,
  location TEXT,
  platform meeting_platform,
  meeting_link TEXT,
  created_by UUID REFERENCES profiles(id),
  committee_id UUID REFERENCES committees(id),
  participants UUID[],
  agenda TEXT,
  minutes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Changes Made

### File: app/dashboard/forms/create/page.tsx

#### Before (Broken)
```typescript
const { data: form, error: formError } = await (supabase as any)
  .from('forms')
  .insert({
    title: formData.get('title'),
    description: formData.get('description'),
    show_on_homepage: formData.get('show_on_homepage') === 'on', // ❌ Field doesn't exist
    created_by: user?.id
  })
  .select()
  .single();

// Then insert into form_fields table ❌ Old approach
if (fields.length > 0) {
  const { error: fieldsError } = await supabase
    .from('form_fields')
    .insert(fieldsToInsert);
}
```

#### After (Fixed)
```typescript
// Validate fields first
if (fields.length === 0) {
  toast.error('Please add at least one field to the form');
  return;
}

const invalidFields = fields.filter(f => !f.label.trim());
if (invalidFields.length > 0) {
  toast.error('All fields must have labels');
  return;
}

// Create form with fields as JSONB
const { data: form, error: formError } = await supabase
  .from('forms')
  .insert({
    title: formData.get('title'),
    description: formData.get('description'),
    fields: fields, // ✅ Store as JSONB
    created_by: user.id,
    is_active: true
  })
  .select()
  .single();
```

## SQL Migration Required

Run this SQL to fix the database schema:

```sql
-- Create ENUM types
CREATE TYPE meeting_type AS ENUM ('online', 'offline');
CREATE TYPE meeting_platform AS ENUM ('microsoft_teams', 'google_meet', 'zoom', 'other');

-- Ensure tables exist with correct schema
-- (See FIX_FORMS_MEETINGS_SCHEMA.sql for complete migration)
```

## Testing

### Test Forms Creation
1. Navigate to `/dashboard/forms/create`
2. Enter form title and description
3. Add at least one field with a label
4. Click "Create Form"
5. Verify form is created successfully
6. Verify you're redirected to the form page
7. Verify link is copied to clipboard

### Test Meetings Creation
1. Navigate to `/dashboard/meetings/create`
2. Fill in meeting details
3. Select meeting type (online/offline)
4. If online, select platform
5. If offline, enter location
6. Click "Create Meeting"
7. Verify meeting is created successfully

### Test Forms Display
1. Navigate to `/dashboard/forms`
2. Verify forms list loads
3. Click on a form
4. Verify form details display correctly

### Test Meetings Display
1. Navigate to `/dashboard/meetings`
2. Verify meetings list loads
3. Verify meeting details display correctly

## Common Errors and Solutions

### Error: "Failed to create form"
**Solution**: 
- Ensure you've added at least one field
- Ensure all fields have labels
- Check browser console for specific error

### Error: "Could not find the 'meeting_type' column"
**Solution**: 
- Run the SQL migration: `FIX_FORMS_MEETINGS_SCHEMA.sql`
- This creates the required ENUM types and tables

### Error: "show_on_homepage does not exist"
**Solution**: 
- Already fixed in the code update
- This field was removed from the insert

## Status

✅ Forms creation - Fixed
✅ Meetings schema - SQL migration provided
✅ Field validation - Added
✅ Error messages - Improved
✅ No TypeScript errors
✅ Ready for testing (after running SQL migration)

## Files Modified

1. ✅ app/dashboard/forms/create/page.tsx
   - Removed `show_on_homepage` field
   - Changed to use JSONB `fields` column
   - Added validation
   - Improved error handling

2. 📄 FIX_FORMS_MEETINGS_SCHEMA.sql (NEW)
   - Complete database schema fix
   - Creates ENUM types
   - Creates/updates tables
   - Adds RLS policies
   - Includes verification queries

## Next Steps

1. **Run the SQL migration**:
   - Open Supabase SQL Editor
   - Copy contents of `FIX_FORMS_MEETINGS_SCHEMA.sql`
   - Execute the SQL
   - Verify success message

2. **Test forms creation**:
   - Try creating a new form
   - Verify it works without errors

3. **Test meetings creation**:
   - Try creating a new meeting
   - Verify it works without errors

4. **Check existing data**:
   - Verify existing forms still work
   - Verify existing meetings still work

## Related Files
- app/dashboard/forms/create/page.tsx
- app/dashboard/meetings/create/page.tsx
- FIX_FORMS_MEETINGS_SCHEMA.sql
- supabase/migrations/023_strict_role_based_system.sql
