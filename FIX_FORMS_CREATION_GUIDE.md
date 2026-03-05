# Fix Forms Creation Error

## Problem
Form creation is failing with "Failed to create form" error.

## Root Causes
1. Missing `show_on_homepage` column in the `forms` table
2. Possible missing `form_fields` table or RLS policies
3. Schema mismatch between migrations

## Solution

### Step 1: Run the SQL Fix
Run the `FIX_FORMS_CREATION.sql` file in your Supabase SQL Editor:

```bash
# Copy the contents of FIX_FORMS_CREATION.sql and paste into Supabase SQL Editor
```

This will:
- Add the missing `show_on_homepage` column
- Ensure `form_fields` table exists
- Add proper RLS policies for form field creation
- Add performance indexes

### Step 2: Test Form Creation
1. Go to `/dashboard/forms/create`
2. Fill in the form details:
   - Title: "Test Form"
   - Description: "Testing form creation"
   - Check "Show on Homepage" if desired
3. Add some fields (optional)
4. Click "Create Form"

### Step 3: Verify
Check the browser console for any errors. The form should:
- Create successfully
- Copy the form link to clipboard
- Redirect to the form detail page

## What Was Fixed
- ✅ Added `show_on_homepage` column to forms table
- ✅ Ensured `form_fields` table exists with proper structure
- ✅ Added RLS policies for form field management
- ✅ Added indexes for better query performance

## If Still Failing
Check the browser console (F12) for the specific error message and share it for further debugging.
