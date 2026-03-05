# Fix Forms Creation - Allow All Users

## Issue
Users are getting "failed to create form" error because the RLS policy only allows committee heads/co-heads to create forms.

## Solution
Run the migration to allow all authenticated users to create forms.

## Steps

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/041_allow_all_users_create_forms.sql`
4. Click "Run"

### Option 2: Using Supabase CLI
```bash
supabase db push
```

## What This Does
- Removes the restrictive policy that only allowed heads/co-heads to create forms
- Adds a new policy allowing ALL authenticated users to create forms
- Ensures users can update their own forms
- Maintains admin access to all forms

## Verification
After running the migration:
1. Log in as any user (not just head/co-head)
2. Go to Dashboard → Forms → Create Form
3. Try creating a form
4. Should work without errors!

## Policy Details
- **Create**: All authenticated users
- **View**: All users can view active forms, creators can view their own inactive forms
- **Update**: Form creators and admins
- **Delete**: Admins only (existing policy)
