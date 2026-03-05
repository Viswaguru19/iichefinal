# 🎯 Task Management & Event Progress System - Implementation Plan

## Overview
Complete task assignment, tracking, and event poster management system with EC approval workflow.

## ✅ Requirements Breakdown

### 1. Notification when Proposal Accepted
- [x] Add notification trigger when event becomes 'active'
- [x] Notify proposing committee members
- [x] Message: "Proposal Accepted! Assign Tasks"
- [x] Link to event progress page

### 2. Fix Event Progress Visibility
- [ ] Only show events with status='active' OR 'in_progress'
- [ ] Hide pending_head_approval, pending_ec_approval, rejected_by_head
- [ ] Update query filter in event progress page

### 3. Task Assignment System
- [x] Proposing committee can assign tasks to other committees
- [x] Tasks need EC approval before assignment
- [x] Notifications sent to EC when task assigned
- [x] Notifications sent to assigned committee when approved
- [x] Tasks visible in task section

### 4. Task Progress Tracking
- [x] Slider to show completion percentage (0-100%)
- [x] Update task status (approved → in_progress → completed)
- [x] Mark as done functionality
- [x] Upload documents (stored event-wise)
- [x] Documents visible in documents section

### 5. Event Poster Upload (Graphics Committee Only)
- [ ] Graphics committee can upload poster when event is active/in_progress
- [ ] Designated size validation (e.g., 1920x1080)
- [ ] Display on homepage with event
- [ ] Visible when members click event
- [ ] Stored in events table (poster_url column)

## 📊 Database Schema

### Tables Created:
1. **task_assignments** - Main task tracking
   - id, event_id, title, description
   - assigned_to_committee, assigned_by_committee, assigned_by_user
   - status (pending_ec_approval, approved, in_progress, completed, rejected)
   - progress (0-100)
   - ec_approved_by, ec_approved_at
   - started_at, completed_at

2. **task_updates** - Task progress logs
   - id, task_id, user_id
   - update_text
   - progress_before, progress_after
   - created_at

3. **task_documents** - Task-related documents
   - id, task_id, event_id
   - file_name, file_url, file_size, file_type
   - uploaded_by, created_at

### Columns Added to events:
- poster_url TEXT
- poster_uploaded_by UUID
- poster_uploaded_at TIMESTAMPTZ

### Enum Values Added:
- in_progress
- completed

## 🔔 Notification Triggers

1. **Task Assignment** → EC members notified
2. **Task Approval** → Assigned committee notified
3. **Task Completion** → Proposing committee notified
4. **Event Active** → Proposing committee notified (can assign tasks)

## 🎨 UI Components

### Task Management Page (`/dashboard/tasks`)
- [x] List all tasks (filtered by role)
- [x] Assign task button (for proposing committee)
- [x] EC approval section (for EC members)
- [x] Progress slider (for assigned committee)
- [x] Post update with document upload
- [x] Mark as complete button

### Event Progress Page (`/dashboard/events/progress`)
- [ ] Only show active/in_progress events
- [ ] Poster upload button (Graphics committee only)
- [ ] Display event poster if uploaded
- [ ] Link to assign tasks

### Homepage (`/`)
- [ ] Display event posters with upcoming events
- [ ] Click event to see details with poster

### Event Detail Page
- [ ] Show event poster
- [ ] Show assigned tasks
- [ ] Show task progress
- [ ] Show documents uploaded for event

## 🔐 Permissions

### Task Assignment:
- Proposing committee members can assign tasks
- Only for events with status='active' or 'in_progress'

### Task Approval:
- EC members can approve/reject tasks
- Only for tasks with status='pending_ec_approval'

### Task Updates:
- Assigned committee members can update progress
- Can post updates and upload documents
- Can mark as complete

### Poster Upload:
- Only Graphics committee members
- Only for active/in_progress events
- Size validation (1920x1080 recommended)

## 📁 Files to Create/Update

### SQL Scripts:
- [x] CREATE_TASK_MANAGEMENT_SYSTEM.sql

### Pages:
- [x] app/dashboard/tasks/page.tsx (updated)
- [ ] app/dashboard/events/progress/page.tsx (update)
- [ ] app/page.tsx (update to show posters)
- [ ] app/dashboard/event-detail/[id]/page.tsx (create)

### Components:
- [ ] components/events/PosterUploadModal.tsx
- [ ] components/events/EventCard.tsx (with poster)
- [ ] components/tasks/TaskCard.tsx
- [ ] components/tasks/ProgressSlider.tsx

### Storage Buckets:
- [ ] event-posters (public read)
- [ ] event-documents (public read)

## 🚀 Implementation Steps

### Phase 1: Database Setup ✅
1. Run CREATE_TASK_MANAGEMENT_SYSTEM.sql
2. Verify tables created
3. Verify triggers working

### Phase 2: Task Management ✅
1. Update tasks page with new schema
2. Add progress slider
3. Add document upload
4. Test EC approval workflow

### Phase 3: Event Progress (In Progress)
1. Fix visibility filter (active + in_progress only)
2. Add poster upload for Graphics committee
3. Display posters on events
4. Link to task assignment

### Phase 4: Homepage Integration
1. Update homepage to show event posters
2. Add event detail modal/page
3. Display tasks and progress

### Phase 5: Documents Section
1. Create documents page
2. Show documents by event
3. Filter by task
4. Download functionality

## 🧪 Testing Checklist

### Task Assignment:
- [ ] Proposing committee can assign task
- [ ] Task goes to pending_ec_approval
- [ ] EC members get notification
- [ ] EC can approve task
- [ ] Assigned committee gets notification
- [ ] Task appears in their task list

### Task Progress:
- [ ] Assigned committee can start task
- [ ] Progress slider works (0-100%)
- [ ] Updates are logged
- [ ] Documents upload successfully
- [ ] Documents stored event-wise
- [ ] Mark as complete works

### Poster Upload:
- [ ] Only Graphics committee sees upload button
- [ ] Size validation works
- [ ] Poster uploads successfully
- [ ] Poster displays on homepage
- [ ] Poster displays in event detail

### Notifications:
- [ ] Task assignment → EC notified
- [ ] Task approval → Committee notified
- [ ] Task completion → Proposer notified
- [ ] Event active → Proposer notified

## 📝 Next Steps

1. Run SQL script: `CREATE_TASK_MANAGEMENT_SYSTEM.sql`
2. Update event progress page visibility filter
3. Create poster upload component
4. Update homepage to show posters
5. Test complete workflow

## 🎯 Success Criteria

- ✅ Tasks can be assigned with EC approval
- ✅ Progress slider works smoothly
- ✅ Documents upload and display correctly
- ⏳ Posters upload (Graphics only)
- ⏳ Posters display on homepage
- ⏳ Event progress shows only active/in_progress events
- ✅ All notifications working
- ✅ Complete workflow tested

## 📊 Current Status

**Completed:**
- Database schema created
- Task management page updated
- Progress slider implemented
- Document upload working
- Notifications configured

**In Progress:**
- Event progress page update
- Poster upload component
- Homepage poster display

**Pending:**
- Event detail page
- Documents section page
- Complete testing

---

*Last Updated: [Current Date]*
*Status: 60% Complete*
