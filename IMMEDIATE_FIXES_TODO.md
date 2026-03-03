# Immediate Fixes - Action Plan

## Status: Supabase is Working ✅

## Critical Fixes (Do in Order)

### 1. Task System Fix
**Files:** `app/dashboard/tasks/page.tsx`
**Issues:**
- Using old `event_tasks` table (should use `tasks` from migration 023)
- No permission check (anyone can update any task)
- Update button not working properly

**Fix:**
- Change queries to use `tasks` table
- Add permission check: only assigned committee members can update
- Fix update button functionality
- Add proper error handling

### 2. Profile Image Upload & Display
**Files:** 
- `app/dashboard/profile/page.tsx`
- `app/committees/page.tsx`
- `app/committees/[id]/page.tsx`
- `app/executive/page.tsx`

**Issues:**
- Profile image upload not working
- Images not showing in committees page
- Images not showing in executive page

**Fix:**
- Fix upload to `avatars` bucket
- Update avatar_url in profiles table
- Display images in all relevant pages

### 3. Executive Committee Display
**Files:**
- `app/executive/page.tsx`
- `app/page.tsx` (homepage)

**Issue:** Shows all heads/co-heads instead of only 6 with executive_role

**Fix:**
```sql
-- Change query from:
SELECT * FROM committee_members WHERE position IN ('head', 'co_head')

-- To:
SELECT * FROM profiles WHERE executive_role IS NOT NULL
```

### 4. Event Approval Workflow
**Files:**
- `app/dashboard/propose-event/page.tsx`
- `app/dashboard/proposals/page.tsx`
- `lib/permissions-new.ts`

**Issues:**
- Anyone can approve (wrong permissions)
- Co-heads can approve final stages
- Event visibility not restricted

**Fix:**
- Implement strict workflow: Co-head → Head → EC → Faculty
- Add permission checks at each stage
- Restrict visibility based on status

### 5. Meeting System
**Files:**
- `app/dashboard/meetings/page.tsx` - Fix list view
- `app/dashboard/meetings/create/page.tsx` - Add online/offline selection

**Issues:**
- Only redirects, doesn't show meetings
- No online/offline selection
- No email invitations
- No reminders

**Fix:**
- Show list of upcoming/past meetings
- Add meeting type selector
- Integrate email sending (already have utils)
- Add reminder system

### 6. Forms Integration
**Files:** `app/dashboard/forms/*`

**Issue:** Not properly integrated

**Fix:** Link forms to events, fix response storage

### 7. Premium Progress Bar
**File:** `app/dashboard/events/progress/page.tsx`

**Issue:** Basic design

**Fix:** Create premium animated progress bar

---

## Quick Wins (Can do immediately)

1. **Executive Committee Fix** - 5 minutes
2. **Profile Image Display** - 10 minutes  
3. **Task Permission Check** - 15 minutes

## Medium Effort

4. **Event Approval Workflow** - 1 hour
5. **Meeting List View** - 30 minutes
6. **Task System Overhaul** - 1 hour

## Requires More Work

7. **Meeting Invitations** - 1 hour
8. **Forms Integration** - 1 hour
9. **Premium Progress Bar** - 30 minutes

---

## Start Here

Since Supabase is working, let's start with the quickest fixes first to show immediate progress, then tackle the bigger issues.

**Order of implementation:**
1. Executive Committee (5 min) ✅
2. Profile Image Display (10 min) ✅
3. Task Permissions (15 min) ✅
4. Task Update Button (15 min) ✅
5. Event Approval Workflow (1 hour)
6. Meeting System (1.5 hours)
7. Forms & Progress Bar (1.5 hours)

**Total time: ~5 hours**

Ready to start!
