# How to Add Slideshow Photos 📸

## Where to Add Photos

Go to: **`/dashboard/admin/slideshow`**

This page is accessible to:
- Super Admin
- Executive Committee members

## Step-by-Step Guide

### 1. Access the Slideshow Management Page
- Login to your admin account
- Navigate to `/dashboard/admin/slideshow`
- Or go to Dashboard → Admin Panel → Slideshow Management

### 2. Upload a New Photo

Click the **"Upload New Photo"** button at the top

#### Fill in the Upload Form:

**Photo (Required)**
- Click the upload area or drag and drop
- Supported formats: PNG, JPG, GIF
- Maximum size: 5MB
- Recommended size: 1920x1080px (Full HD) or 1920x600px (wide banner)

**Title (Optional)**
- Add a headline that appears on the slide
- Example: "Welcome to IIChE AVVU"
- Example: "Annual Tech Fest 2026"

**Description (Optional)**
- Add a subtitle or brief description
- Example: "Join us for exciting events and workshops"
- Appears below the title

**Link URL (Optional)**
- Add a clickable link (must start with https://)
- Example: "https://example.com/event"
- A "Learn More" button will appear if you add a link

### 3. Click "Upload Photo"
- Photo uploads automatically
- Auto-approved for admin/EC members
- Appears immediately on the homepage

## Managing Existing Photos

### View All Photos
- All uploaded photos appear in a grid below the upload form
- Shows photo preview, title, description, and order

### Show/Hide Photos
- Click the **Eye icon** to toggle visibility
- Green eye = Active (visible on homepage)
- Gray eye = Hidden (not visible)

### Delete Photos
- Click the **Trash icon** to delete
- Removes from both database and storage
- Requires confirmation

### Photo Order
- Photos display in order (Order: 1, 2, 3...)
- Lower numbers appear first in the slideshow

## Where Photos Appear

The slideshow appears on:
- **Homepage** (`/`) - Main hero section at the top
- Auto-rotates every 5 seconds
- Pauses on hover
- Navigation arrows and dots for manual control

## Photo Guidelines

### Best Practices
- Use high-quality images (1920x1080px or larger)
- Keep file size under 5MB for fast loading
- Use landscape orientation (16:9 ratio)
- Ensure text is readable if overlaying title/description
- Use images with good contrast for text overlay

### Content Suggestions
- Event photos
- Campus activities
- Team photos
- Achievement highlights
- Upcoming event promotions
- Sponsor logos/banners

### Text Overlay Tips
- Keep titles short (5-8 words)
- Descriptions should be 1-2 sentences
- Text appears in white with shadow for readability
- Works best on darker or blurred backgrounds

## Technical Details

### Storage
- Photos stored in Supabase Storage bucket: `slideshow-photos`
- Path format: `slideshow/{uuid}.{ext}`
- Public URLs generated automatically

### Database
- Table: `homepage_slideshow`
- Fields: photo_url, title, description, link_url, is_active, display_order
- Auto-approved for admin/EC roles

### Display
- Component: `HeroSlideshow` in `components/home/HeroSlideshow.tsx`
- Auto-play interval: 5 seconds
- Smooth fade transitions
- Responsive design (mobile-friendly)

## Troubleshooting

**Photo not appearing?**
- Check if it's marked as active (green eye icon)
- Verify file uploaded successfully
- Refresh the homepage

**Upload failed?**
- Check file size (must be under 5MB)
- Verify file is an image (PNG, JPG, GIF)
- Check your internet connection

**Can't access the page?**
- Verify you have admin or EC role
- Contact super admin for access

## Quick Tips

1. Upload 3-5 photos for a good rotation
2. Update seasonally with current events
3. Hide old photos instead of deleting (can reactivate later)
4. Test on mobile to ensure text is readable
5. Use consistent image dimensions for smooth transitions

Need help? Contact your system administrator!
