# Critical Fixes Required - IIChE Portal

## Priority Issues to Fix

### 1. Event Approval Workflow (CRITICAL)
**Current Issue:** Anyone can approve, co-heads can approve final stages
**Required Flow:**
```
Co-Head Proposes Event
    ↓
Committee Head Approves (visible only to committee + EC)
    ↓
EC Members Approve (all 6 must vote/approve)
    ↓
Faculty Approves (from faculty login)
    ↓
Event becomes ACTIVE (visible to all)
```

**Visibility Rules:**
- Draft: Only proposer can see
- Pending Head Approval: Committee + EC can see
- Pending EC Approval: Committee + EC can see
- Pending Faculty Approval: Committee + EC + Faculty can see
- Active: Everyone can see

**Files to Fix:**
- `app/dashboard/propose-event/page.tsx` - Proposal creation
- `app/dashboard/proposals/page.tsx` - Approval interface
- `lib/permissions-new.ts` - Permission checks
- `supabase/migrations/024_rls_policies.sql` - RLS policies

---

### 2. Meeting System (HIGH PRIORITY)

#### Issue A: Meetings Not Shown
**Current:** Only redirects, no list of scheduled meetings
**Required:** 
- Show all upcoming meetings
- Show past meetings
- Filter by committee
- Show meeting details

#### Issue B: Online/Offline Not Asked
**Current:** No meeting type selection
**Required:**
- Ask: Online or Offline?
- If Online: Show platform selection (Teams/Meet/Zoom)
- If Offline: Ask for location
- Generate meeting link for online
- Send calendar invite

#### Issue C: Meeting Invitations Not Sent
**Current:** No emails sent
**Required:**
- Auto-send email to all participants
- Include meeting link (if online)
- Include location (if offline)
- Include agenda
- Add to calendar (iCal attachment)

#### Issue D: Reminders Not Sent
**Current:** No reminder system
**Required:**
- Send reminder 24 hours before
- Send reminder 1 hour before
- In-app notification
- Email notification

**Files to Fix:**
- `app/dashboard/meetings/page.tsx` - List view
- `app/dashboard/meetings/create/page.tsx` - Creation form
- `lib/meeting-utils.ts` - Already has functions, need to integrate
- Create API route: `app/api/meetings/send-invites/route.ts`
- Create API route: `app/api/meetings/send-reminders/route.ts`

---

### 3. Forms Integration (MEDIUM PRIORITY)

**Current Issue:** Forms not properly integrated
**Required:**
- Forms linked to events
- Form responses stored correctly
- Form analytics shown
- Export responses

**Files to Fix:**
- `app/dashboard/forms/page.tsx`
- `app/dashboard/forms/create/page.tsx`
- `app/dashboard/forms/[id]/page.tsx`
- `app/dashboard/forms/[id]/responses/page.tsx`

---

### 4. Executive Committee Display (HIGH PRIORITY)

**Current Issue:** Shows all heads/co-heads
**Required:** Only show 6 members with executive_role assigned

**Logic:**
```typescript
// Only these 6 roles should appear in Executive Committee:
- Secretary
- Joint Secretary  
- Associate Secretary
- Associate Joint Secretary
- Treasurer
- Associate Treasurer

// Committee heads/co-heads should NOT auto-appear
// Only if admin assigns them an executive_role
```

**Files to Fix:**
- `app/executive/page.tsx`
- `app/page.tsx` (homepage executive section)
- Query: `WHERE executive_role IS NOT NULL` (not by committee position)

---

### 5. Event Progress Bar (MEDIUM PRIORITY)

**Current Issue:** Basic progress bar
**Required:** Premium design with:
- Animated progress
- Stage indicators
- Approval status icons
- Timeline view
- Smooth transitions
- Modern gradient design

**Files to Fix:**
- `app/dashboard/events/progress/page.tsx`
- Create new component: `components/events/PremiumProgressBar.tsx`

---

### 6. Faculty Login Option (CRITICAL)

**Current Issue:** No faculty login option during admin approval
**Required:**
- Faculty can login separately
- Faculty dashboard shows pending approvals
- Faculty can approve events, emails, posters
- Faculty role assignment by admin

**Files to Fix:**
- `app/login/page.tsx` - Add faculty login flow
- `app/dashboard/admin/user-management/page.tsx` - Add faculty role assignment
- Already created: `app/dashboard/faculty/page.tsx` ✅

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. ✅ Event approval workflow
2. ✅ Event visibility rules
3. ✅ Permission system fixes
4. ✅ Faculty login and role assignment
5. ✅ Executive committee display fix

### Phase 2: High Priority
6. ✅ Meeting list view
7. ✅ Meeting creation with online/offline
8. ✅ Meeting invitation emails
9. ✅ Meeting reminders

### Phase 3: Medium Priority
10. ✅ Forms integration
11. ✅ Premium progress bar
12. ✅ Additional polish

---

## Detailed Fix Plans

### Fix 1: Event Approval Workflow

#### Step 1: Update Event Status Enum
Already done in migration 023 ✅

#### Step 2: Fix Proposal Creation
```typescript
// app/dashboard/propose-event/page.tsx
// Only co-heads can propose
// Status starts as 'pending_head_approval'
// Only visible to committee + EC
```

#### Step 3: Fix Head Approval
```typescript
// Only committee HEAD can approve
// Changes status to 'pending_ec_approval'
// Notifies EC members
```

#### Step 4: Fix EC Approval
```typescript
// Only users with executive_role can approve
// Need majority vote (4 out of 6)
// Changes status to 'pending_faculty_approval'
// Notifies faculty
```

#### Step 5: Fix Faculty Approval
```typescript
// Only faculty can approve
// Changes status to 'active'
// Event becomes public
// Notifies committee
```

---

### Fix 2: Meeting System

#### Step 1: Create Meeting List View
```typescript
// app/dashboard/meetings/page.tsx
// Show upcoming meetings
// Show past meetings
// Filter options
// Meeting cards with details
```

#### Step 2: Fix Meeting Creation
```typescript
// app/dashboard/meetings/create/page.tsx
// Step 1: Ask Online or Offline
// Step 2: If Online - platform selection
// Step 3: If Offline - location input
// Step 4: Date, time, duration
// Step 5: Select participants
// Step 6: Add agenda
// Step 7: Create & send invites
```

#### Step 3: Create Email Sending API
```typescript
// app/api/meetings/send-invites/route.ts
// Use Resend to send emails
// Include meeting details
// Attach iCal file
// Send to all participants
```

#### Step 4: Create Reminder System
```typescript
// app/api/meetings/send-reminders/route.ts
// Check meetings in next 24 hours
// Send reminder emails
// Create in-app notifications
// Can be triggered by cron job
```

---

### Fix 3: Executive Committee Display

#### Current Query (Wrong):
```sql
SELECT * FROM committee_members 
WHERE position IN ('head', 'co_head')
```

#### Correct Query:
```sql
SELECT * FROM profiles 
WHERE executive_role IS NOT NULL
AND is_active = TRUE
ORDER BY 
  CASE executive_role
    WHEN 'secretary' THEN 1
    WHEN 'joint_secretary' THEN 2
    WHEN 'associate_secretary' THEN 3
    WHEN 'associate_joint_secretary' THEN 4
    WHEN 'treasurer' THEN 5
    WHEN 'associate_treasurer' THEN 6
  END
```

---

## Files That Need Creation

### New Files to Create:
1. `app/api/meetings/send-invites/route.ts`
2. `app/api/meetings/send-reminders/route.ts`
3. `components/events/PremiumProgressBar.tsx`
4. `components/meetings/MeetingCard.tsx`
5. `components/meetings/MeetingTypeSelector.tsx`
6. `lib/email-templates.ts` (for meeting invites)

### Files to Modify:
1. `app/dashboard/propose-event/page.tsx`
2. `app/dashboard/proposals/page.tsx`
3. `app/dashboard/meetings/page.tsx`
4. `app/dashboard/meetings/create/page.tsx`
5. `app/dashboard/events/progress/page.tsx`
6. `app/executive/page.tsx`
7. `app/page.tsx`
8. `lib/permissions-new.ts`
9. `supabase/migrations/024_rls_policies.sql`

---

## Testing Checklist

After fixes:
- [ ] Co-head can propose event
- [ ] Only committee head can approve first
- [ ] Only EC members can approve second
- [ ] Only faculty can approve final
- [ ] Event visibility follows rules
- [ ] Meetings show in list
- [ ] Meeting creation asks online/offline
- [ ] Meeting invites sent via email
- [ ] Reminders sent before meetings
- [ ] Forms work properly
- [ ] Executive committee shows only 6 members
- [ ] Progress bar looks premium
- [ ] Faculty can login and approve

---

## Estimated Time

- Event approval workflow: 2-3 hours
- Meeting system fixes: 3-4 hours
- Forms integration: 1-2 hours
- Executive committee fix: 30 minutes
- Progress bar redesign: 1 hour
- Testing: 2 hours

**Total: 10-12 hours of development**

---

## Next Steps

1. Wait for Supabase to come online
2. Start with Phase 1 (Critical fixes)
3. Test each fix thoroughly
4. Move to Phase 2
5. Final testing and polish

**Ready to start implementing once Supabase is back online!**
