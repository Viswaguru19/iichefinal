# ✅ Workflow Configuration & Profile Photo Management - COMPLETE

## Feature 1: Configurable Approval Thresholds

### What Was Added

Admin can now configure approval requirements in the Workflow Config page:

#### 1. Head Approvals Required
- **Option 1**: Single Head Approval (default)
- **Option 2**: Both Head and Co-Head Approval

#### 2. EC Approval Mode
Three modes available:

**Mode 1: Any One Secretary** (default)
- Any combination of Secretary, Associate Secretary, Joint Secretary, or Associate Joint Secretary
- Can configure how many approvals needed (1-4)
- Example: Any 2 of the 4 EC members

**Mode 2: One From Each Tier**
- 1 approval from (Secretary OR Associate Secretary)
- AND 1 approval from (Joint Secretary OR Associate Joint Secretary)
- Ensures representation from both tiers

**Mode 3: All Four**
- All 4 EC members must approve
- Secretary, Associate Secretary, Joint Secretary, Associate Joint Secretary
- Maximum oversight

### Database Setup

**File**: `ADD_WORKFLOW_CONFIG_SETTINGS.sql`

Run this SQL to create the workflow_config table and set defaults:
- Creates `workflow_config` table
- Adds `approval_thresholds` configuration
- Sets default: 1 head approval, any 1 secretary mode
- Adds RLS policies

### UI Updates

**File**: `app/dashboard/workflow-config/page.tsx`

Added new section at the top:
- Dropdown for head approvals (1 or 2)
- Dropdown for EC approval mode (3 options)
- Conditional dropdown for number of EC approvals (when in "any one" mode)
- Live preview of current configuration

### How to Use

1. Run `ADD_WORKFLOW_CONFIG_SETTINGS.sql` in Supabase SQL Editor
2. Go to Dashboard → Admin → Workflow Configuration
3. Configure approval thresholds at the top
4. Click "Save Configuration"

### Configuration Examples

**Strict Mode:**
- Head Approvals: 2 (Head + Co-Head)
- EC Mode: All Four
- Result: Maximum oversight, slowest approval

**Balanced Mode:**
- Head Approvals: 1 (Single Head)
- EC Mode: One From Each Tier
- Result: Good oversight, reasonable speed

**Fast Mode:**
- Head Approvals: 1 (Single Head)
- EC Mode: Any One Secretary (1 approval)
- Result: Minimal oversight, fastest approval

---

## Feature 2: Admin Profile Photo Management

### What Was Added

Admins can now click on any user's name/photo in the Users page to upload or change their profile photo.

### Components Created

**File**: `components/admin/UserProfilePhotoModal.tsx`

Modal with features:
- Current photo preview (or placeholder if none)
- Upload new photo button
- Remove photo button
- File validation (image types only, max 5MB)
- Automatic upload to Supabase Storage
- Updates profile in database

### UI Updates

**File**: `components/dashboard/UserTable.tsx`

Added:
- Photo column at the start of the table
- Clickable photo/camera icon for each user
- Hover effect showing camera icon
- Opens UserProfilePhotoModal on click

### Database Setup

**File**: `CREATE_PROFILE_PHOTOS_BUCKET.sql`

Run this SQL to set up storage:
- Creates `profile-photos` storage bucket (public)
- Adds storage policies for admin upload/update/delete
- Adds `profile_photo` column to profiles table
- Public read access for all users

### How to Use

1. Run `CREATE_PROFILE_PHOTOS_BUCKET.sql` in Supabase SQL Editor
2. Go to Dashboard → Admin → Users
3. Click on any user's photo/camera icon
4. Upload new photo or remove existing photo
5. Photo is automatically saved and displayed

### Storage Structure

```
profile-photos/
  ├── {user_id}-{timestamp}.jpg
  ├── {user_id}-{timestamp}.png
  └── ...
```

### Features

- Supports JPG, PNG, GIF formats
- Max file size: 5MB
- Automatic filename generation
- Public URLs for easy access
- Upsert mode (replaces old photos)
- Remove photo option

---

## Files Created

1. `ADD_WORKFLOW_CONFIG_SETTINGS.sql` - Workflow config database setup
2. `CREATE_PROFILE_PHOTOS_BUCKET.sql` - Profile photos storage setup
3. `components/admin/UserProfilePhotoModal.tsx` - Photo upload modal
4. `WORKFLOW_AND_PROFILE_FEATURES_COMPLETE.md` - This documentation

## Files Updated

1. `app/dashboard/workflow-config/page.tsx` - Added approval threshold config
2. `components/dashboard/UserTable.tsx` - Added photo column and modal

---

## Setup Instructions

### Step 1: Run SQL Files

In Supabase SQL Editor, run in order:

1. `ADD_WORKFLOW_CONFIG_SETTINGS.sql`
2. `CREATE_PROFILE_PHOTOS_BUCKET.sql`

### Step 2: Verify Setup

Check that:
- [ ] workflow_config table exists
- [ ] approval_thresholds row exists in workflow_config
- [ ] profile-photos bucket exists in Storage
- [ ] profile_photo column exists in profiles table

### Step 3: Test Features

**Test Workflow Config:**
1. Go to /dashboard/workflow-config
2. Change head approvals to 2
3. Change EC mode to "One From Each Tier"
4. Save and verify settings persist

**Test Profile Photos:**
1. Go to /dashboard/admin/users
2. Click on a user's photo/camera icon
3. Upload a test image
4. Verify photo displays in table
5. Test remove photo button

---

## Integration with Approval Workflow

The approval thresholds are stored in the database and can be read by the proposals page to enforce the configured rules:

```typescript
// Example: Read approval config
const { data: config } = await supabase
  .from('workflow_config')
  .select('config')
  .eq('workflow_type', 'approval_thresholds')
  .single();

const headApprovalsRequired = config?.config?.head_approvals_required || 1;
const ecApprovalMode = config?.config?.ec_approval_mode || 'any_one_secretary';
const ecApprovalsRequired = config?.config?.ec_approvals_required || 1;
```

To fully integrate, update `app/dashboard/proposals/page.tsx` to:
1. Load approval config on mount
2. Check head approval count before moving to EC
3. Implement EC approval logic based on mode
4. Show progress based on configured thresholds

---

## Notes

- Workflow config is stored in JSONB for flexibility
- Profile photos are stored in public bucket for easy access
- Only admins can upload/change profile photos
- Users can see all profile photos (public read)
- File uploads are validated client-side and server-side
- Old photos are replaced (upsert mode) to save storage

---

## Future Enhancements

Possible additions:
- Image cropping/resizing before upload
- Bulk photo upload from CSV
- Photo approval workflow
- User can upload their own photo (with admin approval)
- Photo history/audit trail
- Automatic image optimization

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify SQL scripts ran successfully
3. Check Supabase Storage policies
4. Ensure admin permissions are correct
5. Test with different image formats/sizes
