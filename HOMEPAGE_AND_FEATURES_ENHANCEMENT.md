# Homepage and Features Enhancement Plan

## Overview
This document outlines the implementation plan for enhancing the IIChE Student Chapter Portal based on features from iicheaavu.netlify.app and additional requirements.

## Quick Fixes Needed

### 1. Fix Meeting Link Column ✅
**File**: `036_add_meeting_link.sql`
- Add `meeting_link` column to meetings table
- Run this migration immediately

### 2. Show Profile Photos in Committee Members
**Files to Update**:
- `app/committees/[id]/page.tsx` - Committee detail page
- Show member photos, names, positions, and descriptions
- Click member → Show full profile with 5cm x 5cm photo

### 3. Events Page with Photos
**Files to Update**:
- `app/events/page.tsx` - Public events listing
- Show event photos, details, date, location
- Past events archive
- Event detail pages with photo galleries

### 4. Homepage Photo Slideshow
**New Feature**:
- Auto-playing slideshow on homepage
- Admin/EC can upload photos
- Other committees need EC approval
- Smooth transitions and animations

## Feature Comparison: iicheaavu.netlify.app

### Existing Features (Already Implemented)
- ✅ About page
- ✅ Committees page
- ✅ Executive committee page
- ✅ Events listing
- ✅ Login/Signup
- ✅ Dashboard

### Missing Features (Need to Add)

#### 1. Homepage Enhancements
- [ ] Hero section with slideshow
- [ ] Quick stats (events conducted, members, committees)
- [ ] Upcoming events preview
- [ ] Latest news/announcements
- [ ] Photo gallery section
- [ ] Contact information

#### 2. Events Page Improvements
- [ ] Event photos/gallery
- [ ] Past events archive
- [ ] Event categories/filters
- [ ] Event registration (if applicable)
- [ ] Event reports/outcomes

#### 3. Gallery/Photos Section
- [ ] Dedicated photo gallery page
- [ ] Album organization
- [ ] Photo upload with approval workflow
- [ ] Lightbox for full-size viewing

#### 4. About Page Enhancements
- [ ] Mission and vision
- [ ] History timeline
- [ ] Achievements
- [ ] Faculty advisors section

## Implementation Plan

### Phase 1: Database Schema (Week 1)

#### Task 1.1: Create Photo Gallery Tables
```sql
CREATE TABLE gallery_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_photo_url TEXT,
  event_id UUID REFERENCES events(id),
  created_by UUID REFERENCES profiles(id),
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gallery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID REFERENCES gallery_albums(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  approval_status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE homepage_slideshow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  link_url TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  approval_status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Task 1.2: Add Event Photos
```sql
ALTER TABLE events
ADD COLUMN IF NOT EXISTS photos TEXT[], -- Array of photo URLs
ADD COLUMN IF NOT EXISTS cover_photo TEXT,
ADD COLUMN IF NOT EXISTS gallery_album_id UUID REFERENCES gallery_albums(id);
```

### Phase 2: Homepage Slideshow (Week 1-2)

#### Task 2.1: Create Slideshow Component
**File**: `components/home/HeroSlideshow.tsx`
- Auto-playing carousel
- Smooth transitions
- Navigation dots
- Pause on hover
- Responsive design

#### Task 2.2: Admin Upload Interface
**File**: `app/dashboard/admin/slideshow/page.tsx`
- Upload photos
- Set title, description, link
- Reorder slides
- Activate/deactivate

#### Task 2.3: EC Approval Workflow
**File**: `app/dashboard/admin/slideshow-approvals/page.tsx`
- Review pending uploads
- Approve/reject with reason
- Notification to uploader

### Phase 3: Enhanced Events Page (Week 2)

#### Task 3.1: Update Events Listing
**File**: `app/events/page.tsx`
- Show event cover photos
- Filter by date, committee, status
- Past events section
- Search functionality

#### Task 3.2: Event Detail Page
**File**: `app/events/[id]/page.tsx`
- Full event details
- Photo gallery
- Registration button (if applicable)
- Related events

#### Task 3.3: Event Photo Upload
**File**: `app/dashboard/events/[id]/photos/page.tsx`
- Upload event photos
- Create albums
- Set cover photo

### Phase 4: Committee Member Profiles (Week 2-3)

#### Task 4.1: Enhanced Committee Detail Page
**File**: `app/committees/[id]/page.tsx`
- Show member photos (5cm x 5cm)
- Display descriptions
- Click to view full profile

#### Task 4.2: Public Profile View
**File**: `app/profile/[id]/page.tsx`
- Large profile photo
- Full description
- Committee roles
- Contact info (if public)

### Phase 5: Photo Gallery (Week 3)

#### Task 5.1: Gallery Page
**File**: `app/gallery/page.tsx`
- Album grid view
- Filter by event, date
- Featured albums

#### Task 5.2: Album View
**File**: `app/gallery/[id]/page.tsx`
- Photo grid
- Lightbox viewer
- Download options

#### Task 5.3: Upload Interface
**File**: `app/dashboard/gallery/upload/page.tsx`
- Create albums
- Upload multiple photos
- Set captions

### Phase 6: Homepage Enhancements (Week 3-4)

#### Task 6.1: Stats Section
- Total events conducted
- Active members
- Committees count
- Animated counters

#### Task 6.2: Upcoming Events Preview
- Next 3-5 events
- Quick registration
- Countdown timers

#### Task 6.3: Latest News/Announcements
- Recent updates
- Important notices
- Scrolling ticker

#### Task 6.4: Quick Links
- Important documents
- Social media
- Contact info

### Phase 7: About Page Enhancement (Week 4)

#### Task 7.1: Mission & Vision
- Animated sections
- Icons and graphics

#### Task 7.2: History Timeline
- Interactive timeline
- Key milestones
- Photos from past

#### Task 7.3: Achievements
- Awards and recognition
- Statistics
- Testimonials

## Database Migrations Summary

### Migration 036: Add meeting_link ✅
```sql
ALTER TABLE meetings ADD COLUMN meeting_link TEXT;
```

### Migration 037: Gallery Tables
```sql
CREATE TABLE gallery_albums (...);
CREATE TABLE gallery_photos (...);
CREATE TABLE homepage_slideshow (...);
```

### Migration 038: Event Photos
```sql
ALTER TABLE events 
ADD COLUMN photos TEXT[],
ADD COLUMN cover_photo TEXT,
ADD COLUMN gallery_album_id UUID;
```

### Migration 039: Public Profile Settings
```sql
ALTER TABLE profiles
ADD COLUMN show_email BOOLEAN DEFAULT FALSE,
ADD COLUMN show_phone BOOLEAN DEFAULT FALSE,
ADD COLUMN social_links JSONB DEFAULT '{}';
```

## Approval Workflow for Photos

### Admin/EC Upload
- Direct approval (no review needed)
- Immediately visible

### Committee Upload
- Status: `pending`
- EC reviews and approves
- Notification on approval/rejection

### Implementation
```typescript
// lib/photo-approval.ts
export async function uploadPhoto(
  photoFile: File,
  albumId: string,
  userId: string,
  userRole: string
) {
  // Upload to storage
  const photoUrl = await uploadToStorage(photoFile);
  
  // Determine approval status
  const isAutoApproved = ['admin', 'secretary', 'treasurer'].includes(userRole);
  
  // Insert with appropriate status
  await supabase.from('gallery_photos').insert({
    album_id: albumId,
    photo_url: photoUrl,
    uploaded_by: userId,
    approval_status: isAutoApproved ? 'approved' : 'pending'
  });
}
```

## UI/UX Improvements

### Animations
- Framer Motion for page transitions
- Smooth scroll effects
- Hover animations on cards
- Loading skeletons

### Design System
- Consistent color palette
- Typography hierarchy
- Spacing system
- Component library

### Responsive Design
- Mobile-first approach
- Tablet optimizations
- Desktop enhancements

## File Structure

```
app/
├── (public)/
│   ├── page.tsx (Homepage with slideshow)
│   ├── about/
│   │   └── page.tsx (Enhanced about)
│   ├── events/
│   │   ├── page.tsx (Events listing with photos)
│   │   └── [id]/
│   │       └── page.tsx (Event detail with gallery)
│   ├── gallery/
│   │   ├── page.tsx (Gallery albums)
│   │   └── [id]/
│   │       └── page.tsx (Album photos)
│   ├── committees/
│   │   └── [id]/
│   │       └── page.tsx (Members with photos)
│   └── profile/
│       └── [id]/
│           └── page.tsx (Public profile view)
│
├── dashboard/
│   ├── admin/
│   │   ├── slideshow/
│   │   │   └── page.tsx (Manage slideshow)
│   │   └── gallery/
│   │       └── page.tsx (Manage gallery)
│   └── gallery/
│       └── upload/
│           └── page.tsx (Upload photos)
│
components/
├── home/
│   ├── HeroSlideshow.tsx
│   ├── StatsSection.tsx
│   ├── UpcomingEvents.tsx
│   └── LatestNews.tsx
├── gallery/
│   ├── PhotoGrid.tsx
│   ├── Lightbox.tsx
│   └── AlbumCard.tsx
└── events/
    ├── EventCard.tsx
    ├── EventGallery.tsx
    └── EventFilters.tsx
```

## Priority Order

### Immediate (This Week)
1. ✅ Fix meeting_link column
2. Show profile photos in committee members
3. Basic homepage slideshow
4. Event photos display

### Short Term (Next 2 Weeks)
1. Gallery upload and approval
2. Enhanced events page
3. Public profile pages
4. Homepage stats and previews

### Medium Term (Next Month)
1. Full gallery system
2. About page enhancements
3. Advanced animations
4. Mobile optimizations

## Next Steps

1. **Run Migration 036** - Fix meeting_link
2. **Review iicheaavu.netlify.app** - Extract exact requirements
3. **Create detailed designs** - Wireframes for new pages
4. **Start with slideshow** - Most visible feature
5. **Iterate based on feedback** - Adjust as needed

Would you like me to:
1. Start implementing the homepage slideshow?
2. Fix the committee member profile display?
3. Create the gallery system?
4. All of the above in phases?

Let me know which feature to prioritize!
