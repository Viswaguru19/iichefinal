# Phase 1: Database Migrations - Run These Now!

## Overview
These migrations set up the database schema for the homepage slideshow, photo gallery, and enhanced profiles.

## Migrations to Run (In Order)

### 1. Migration 036: Add Meeting Link ✅
```sql
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

COMMENT ON COLUMN meetings.meeting_link IS 'URL for online meeting (Teams, Meet, Zoom, etc.)';
```

### 2. Migration 037: Gallery and Slideshow Tables
**File**: `037_gallery_and_slideshow_tables.sql`

Creates:
- `gallery_albums` - Photo albums
- `gallery_photos` - Individual photos with approval workflow
- `homepage_slideshow` - Homepage hero slideshow photos

**Features**:
- Approval workflow (pending/approved/rejected)
- Display ordering
- RLS policies for security
- Auto-approval for admin/EC

### 3. Migration 038: Event Photos
**File**: `038_add_event_photos.sql`

Adds to events table:
- `photos` (TEXT[]) - Array of photo URLs
- `cover_photo` (TEXT) - Main event photo
- `gallery_album_id` (UUID) - Link to photo album

### 4. Migration 039: Public Profile Settings
**File**: `039_public_profile_settings.sql`

Adds to profiles table:
- `show_email` (BOOLEAN) - Privacy setting
- `show_phone` (BOOLEAN) - Privacy setting
- `social_links` (JSONB) - Social media links
- `linkedin_url`, `github_url`, `twitter_url` (TEXT)

## How to Run

### Option 1: Supabase Dashboard (Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Copy content from each migration file
3. Run in order: 036 → 037 → 038 → 039
4. Verify each completes successfully

### Option 2: Supabase CLI
```bash
# Run all migrations
supabase db push

# Or run individually
supabase db execute -f supabase/migrations/036_add_meeting_link.sql
supabase db execute -f supabase/migrations/037_gallery_and_slideshow_tables.sql
supabase db execute -f supabase/migrations/038_add_event_photos.sql
supabase db execute -f supabase/migrations/039_public_profile_settings.sql
```

## Verification

After running migrations, verify with these queries:

### Check Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('gallery_albums', 'gallery_photos', 'homepage_slideshow')
ORDER BY table_name;
```
Should return 3 tables.

### Check Events Columns
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name IN ('photos', 'cover_photo', 'gallery_album_id');
```
Should return 3 columns.

### Check Profiles Columns
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('show_email', 'show_phone', 'social_links', 'linkedin_url');
```
Should return 4+ columns.

### Check RLS Policies
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('gallery_albums', 'gallery_photos', 'homepage_slideshow')
ORDER BY tablename, policyname;
```
Should show multiple policies per table.

## What's Next?

After migrations are complete, we'll implement:

### Phase 2: Homepage Slideshow (Next)
- Hero slideshow component
- Admin upload interface
- Auto-playing carousel
- Smooth transitions

### Phase 3: Committee Member Profiles
- Show photos in committee pages
- Public profile view
- Click to see full details

### Phase 4: Events with Photos
- Event photo galleries
- Cover photos
- Past events archive

### Phase 5: Full Gallery System
- Album management
- Photo upload
- Approval workflow UI

## Approval Workflow Logic

### Admin/EC Uploads
- `approval_status` = 'approved' (auto-approved)
- Immediately visible

### Committee Member Uploads
- `approval_status` = 'pending'
- EC reviews and approves/rejects
- Notification sent on decision

### Implementation Example
```typescript
const isAutoApproved = user.is_admin || user.executive_role !== null;

await supabase.from('homepage_slideshow').insert({
  photo_url: uploadedUrl,
  title: 'Event Photo',
  uploaded_by: user.id,
  approval_status: isAutoApproved ? 'approved' : 'pending'
});
```

## Storage Buckets Needed

Make sure these storage buckets exist in Supabase:
- `avatars` - Profile photos
- `documents` - General files
- `gallery` - Gallery photos (create if not exists)
- `slideshow` - Slideshow photos (create if not exists)

Create missing buckets:
```sql
-- In Supabase Dashboard → Storage → Create Bucket
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('gallery', 'gallery', true),
  ('slideshow', 'slideshow', true)
ON CONFLICT (id) DO NOTHING;
```

## Troubleshooting

### Error: "relation does not exist"
- Make sure you're running migrations in order
- Check if previous migrations completed successfully

### Error: "column already exists"
- Migration may have partially run
- Check which columns exist and skip those parts

### Error: "permission denied"
- Ensure you're connected as the database owner
- Check RLS policies aren't blocking your user

## Ready to Proceed?

Once all 4 migrations are complete:
- [ ] Migration 036 (meeting_link)
- [ ] Migration 037 (gallery tables)
- [ ] Migration 038 (event photos)
- [ ] Migration 039 (profile settings)

Let me know when done, and I'll start implementing the homepage slideshow!
