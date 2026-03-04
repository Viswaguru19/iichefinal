# Role-Based System Overhaul - Requirements

## Overview
Build a comprehensive, strict role-based management system for the IIChE Student Chapter portal at Amrita Vishwa Vidyapeetham (AVV Coimbatore). This system enforces hierarchical permissions, approval workflows, and role-specific dashboards across all features.

## Organization Structure

### Roles Hierarchy
1. **Committee Member** - Base level, assigned tasks
2. **Committee Co-Head** - Can propose events
3. **Committee Head** - Approves co-head proposals
4. **Executive Committee (EC) Members** - 6 positions:
   - Secretary
   - Joint Secretary
   - Associate Secretary
   - Associate Joint Secretary
   - Treasurer
   - Associate Treasurer
5. **Faculty Advisor** - Final approvals, oversight
6. **Admin** - System configuration, overrides

### Role Permissions Matrix

| Feature | Member | Co-Head | Head | EC | Faculty | Admin |
|---------|--------|---------|------|----|---------| ------|
| Propose Event | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Approve Event (Head) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Approve Event (EC) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Approve Event (Faculty) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create Task | ❌ | ✅* | ✅* | ✅ | ❌ | ✅ |
| Approve Task | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Update Task Status | ✅** | ✅** | ✅** | ✅ | ❌ | ✅ |
| Upload Documents | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Draft PR Email | ❌ | ❌*** | ❌*** | ❌ | ❌ | ✅ |
| Approve PR Email | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Upload Poster | ❌ | ❌**** | ❌**** | ❌ | ❌ | ✅ |
| Approve Poster | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Toggle Kickoff | ❌ | ❌***** | ❌***** | ❌ | ❌ | ✅ |
| Approve Registrations | ❌ | ❌****** | ❌****** | ❌ | ❌ | ✅ |
| Manage Schedule | ❌ | ❌****** | ❌****** | ❌ | ❌ | ✅ |
| View Finance | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve Finance | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create Meeting | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change User Password | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Change User Role | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*Only for their committee's active events  
**Only for tasks assigned to their committee  
***Only PR Committee members  
****Only Graphics Committee members  
*****Only Social Committee members  
******Only Environmental Committee members

## Part 1: Event Proposal Workflow (Enhancement)

### Current State
Event proposal workflow exists with head → EC → faculty approval stages.

### Requirements
After faculty approval:
- Event status becomes `active`
- Event is owned by the proposing committee
- Proposing committee can now create and assign tasks
- Event appears in public events list
- Event progress tracking becomes available

**Acceptance Criteria**:
- ✅ Faculty-approved events automatically transition to `active` status
- ✅ Active events are visible to all users
- ✅ Proposing committee can access task creation interface
- ✅ Event ownership is clearly indicated in UI

## Part 2: Task Assignment System

### 2.1 Task Creation

**Who**: Proposing committee (co-head, head) or EC members  
**When**: After event is `active`  
**What**: Create tasks and assign to any committee

**Task Fields**:
- Title (required)
- Description (optional)
- Assigned to committee (required)
- Deadline (optional)
- Supporting documents (optional)
- Priority (low/medium/high)

**Initial Status**: `pending_ec_approval`

**Acceptance Criteria**:
- ✅ Only proposing committee and EC can create tasks for active events
- ✅ Tasks can be assigned to any committee (not just proposing committee)
- ✅ Task creation form validates required fields
- ✅ Documents uploaded during creation are stored in central repository
- ✅ Task appears in EC approval queue immediately

### 2.2 EC Task Approval

**Who**: Any EC member  
**Actions**:
1. **Approve** - Task moves to `not_started`, appears in assigned committee dashboard
2. **Modify & Approve** - EC can edit task details before approving
3. **Reject** - Task moves to `ec_rejected`, reason required

**Approval Threshold**: 1 EC member (as per approval-workflow-updates spec)

**Acceptance Criteria**:
- ✅ EC members see all tasks at `pending_ec_approval` status
- ✅ EC can edit task title, description, deadline, assigned committee before approving
- ✅ Single EC approval transitions task to `not_started`
- ✅ Rejection requires non-empty reason
- ✅ Rejected tasks show rejection reason to proposing committee
- ✅ Approval/rejection is logged with EC member ID and timestamp

### 2.3 Task Execution

**Who**: Assigned committee members  
**Status Flow**: `not_started` → `in_progress` → `partially_completed` → `completed`

**Actions**:
- Update status
- Upload supporting documents
- Add comments/updates
- View task history

**Acceptance Criteria**:
- ✅ Only assigned committee members can update task status
- ✅ All status transitions are valid and logged
- ✅ Documents uploaded are tagged with task, event, committee, uploader
- ✅ Comments show user name and timestamp
- ✅ Task history shows all status changes and updates
- ✅ Completed tasks update event progress bar

### 2.4 Central Documents Repository

**Requirements**:
- All documents from all tasks stored in single "Documents" tab
- Filterable by:
  - Year
  - Month
  - Event
  - Committee
  - Task
  - Uploaded By
- Documents show metadata: filename, size, upload date, uploader, associated task/event

**Acceptance Criteria**:
- ✅ Documents tab accessible from main navigation
- ✅ All filters work independently and in combination
- ✅ Documents can be downloaded by authorized users
- ✅ Document preview available for common formats (PDF, images)
- ✅ Search functionality works across document names and metadata

## Part 3: Faculty Dashboard

### Dashboard Sections

1. **Finance Overview**
   - Total income, expenses, balance
   - Pending finance approvals
   - Recent transactions

2. **Upcoming Events**
   - Next 5 events with dates
   - Event status indicators
   - Quick links to event details

3. **Proposal Approvals**
   - Events at `pending_faculty_approval` status
   - Quick approve/reject actions
   - Approval history

4. **Task Progress**
   - Progress bars for active events
   - Committee-wise task completion
   - Overall organization progress

5. **Kick-Off Status**
   - Registration toggle status
   - Number of registrations
   - Approval status

6. **Meeting Schedules**
   - Upcoming meetings calendar
   - Meeting details and participants

7. **Email/Poster Approvals**
   - Pending PR emails
   - Pending posters
   - Quick approve/reject

8. **Documents Access**
   - Read-only access to all documents
   - Filter and search capabilities
   - Can approve documents requiring approval

**Acceptance Criteria**:
- ✅ All 8 sections visible on faculty dashboard
- ✅ Real-time data updates (no stale data)
- ✅ Quick actions work without page navigation
- ✅ Dashboard loads in under 2 seconds
- ✅ Mobile-responsive layout

## Part 4: PR & Graphics Control

### 4.1 PR Email Workflow

**Who**: PR Committee members  
**Flow**:
1. PR member drafts email (subject, body, recipients)
2. Email status: `draft`
3. PR member submits for approval → status: `pending_faculty_approval`
4. Faculty reviews and approves/rejects
5. If approved → status: `approved`, email can be sent
6. If rejected → status: `rejected`, reason provided

**Acceptance Criteria**:
- ✅ Only PR committee members can draft emails
- ✅ Draft emails can be edited before submission
- ✅ Faculty sees pending emails in approval queue
- ✅ Approved emails can be sent via "Send Email" button
- ✅ Email sending is logged with timestamp and sender
- ✅ Rejected emails show rejection reason

### 4.2 Poster Approval Workflow

**Who**: Graphics Committee members  
**Flow**:
1. Graphics member uploads poster to event
2. Poster status: `pending_faculty_approval`
3. Faculty reviews poster preview
4. Faculty approves/rejects
5. If approved → status: `approved`, poster visible publicly
6. If rejected → status: `rejected`, reason provided

**Acceptance Criteria**:
- ✅ Only Graphics committee members can upload posters
- ✅ Posters linked to specific events
- ✅ Faculty sees poster preview in approval queue
- ✅ Approved posters appear on public event page
- ✅ Rejected posters show rejection reason to uploader
- ✅ Multiple posters per event supported

## Part 5: Social & Environmental Control

### 5.1 Kick-Off Registration Control

**Who**: Social Committee members  
**Feature**: Toggle registration ON/OFF

**When ON**:
- Auto-generate unique registration link
- Link format: `/kickoff/register?event={event_id}`
- Students can register via link
- Registration form captures: name, email, roll number, year, branch
- Registered students appear in dashboard

**When OFF**:
- Registration link disabled
- Message shown: "Registration closed"

**Acceptance Criteria**:
- ✅ Only Social committee members see toggle control
- ✅ Toggle state persists in database
- ✅ Registration link auto-generates when toggled ON
- ✅ Registration form validates all fields
- ✅ Duplicate registrations prevented (by email)
- ✅ Registered students list shows in dashboard

### 5.2 Registration Approval

**Who**: Environmental Committee members  
**Flow**:
1. Students register via link
2. Registrations appear with status: `pending_approval`
3. Environmental committee reviews registrations
4. Can approve or reject with reason
5. Approved registrations: status `approved`
6. Rejected registrations: status `rejected`, reason sent to student

**Acceptance Criteria**:
- ✅ Only Environmental committee sees approval queue
- ✅ Can bulk approve multiple registrations
- ✅ Rejection requires reason
- ✅ Approved count shown on dashboard
- ✅ Students notified of approval/rejection status

### 5.3 Schedule Management

**Who**: Environmental Committee members  
**Flow**:
1. After approving registrations, schedule becomes visible
2. Environmental committee can modify schedule
3. Schedule changes require re-approval
4. Approved schedule visible to all approved students

**Acceptance Criteria**:
- ✅ Schedule editor available to Environmental committee
- ✅ Schedule includes: date, time, venue, agenda
- ✅ Schedule changes tracked with version history
- ✅ Students see only approved schedule
- ✅ Schedule updates notify approved students

## Part 6: Chat System (WhatsApp-like)

### 6.1 Chat Types

1. **Personal Chat (1-to-1)**
   - Any user can chat with any other user
   - Private, end-to-end encrypted
   - Message history persists

2. **Committee Chat**
   - Auto-created for each committee
   - Only committee members can access
   - Shows committee name as chat title

3. **Whole Organization Chat**
   - All users can access
   - Read-only for members, post access for EC/Faculty/Admin
   - Announcements and updates

4. **Executive Committee Chat**
   - Only EC members can access
   - Private EC discussions

5. **Co-Heads Chat**
   - Only committee co-heads can access
   - Cross-committee coordination

6. **Custom Groups**
   - Any user can create group
   - Creator can add members
   - Creator is admin, can remove members

### 6.2 Chat Features

**Core Features**:
- Real-time messaging (WebSocket/Supabase Realtime)
- File & document sharing (images, PDFs, docs)
- Seen status (blue checkmarks)
- Typing indicator ("User is typing...")
- Timestamps (relative: "2 min ago", absolute on hover)
- Message reactions (emoji)
- Reply to specific message
- Delete message (own messages only)
- Edit message (own messages, within 15 min)

**UI Features**:
- Chat list with last message preview
- Unread message count badge
- Search messages
- Pin important chats
- Mute notifications per chat
- Archive chats

**Acceptance Criteria**:
- ✅ All 6 chat types functional
- ✅ Messages deliver in under 1 second
- ✅ Seen status updates in real-time
- ✅ Typing indicator shows within 500ms
- ✅ Files upload and download correctly
- ✅ Role-based access enforced (EC chat only for EC, etc.)
- ✅ Message history loads on scroll (pagination)
- ✅ Mobile-responsive chat interface

## Part 7: Forms Integration Fix

### Current Issues
- Form submissions not saving correctly
- Event-linked forms not mapping to correct event
- Registration data not syncing with kick-off system

### Requirements

**Form Submission**:
- All form responses saved to `form_responses` table
- Response includes: form_id, user_id, responses (JSON), submitted_at
- Duplicate submissions prevented (one per user per form)

**Event Linking**:
- Forms can be linked to events via `event_id` foreign key
- Event detail page shows linked forms
- Form responses filterable by event

**Kick-Off Integration**:
- Kick-off registration form is special form type
- Registration responses sync to `kickoff_registrations` table
- Registration status tracked separately from form submission

**Acceptance Criteria**:
- ✅ Form submissions save correctly to database
- ✅ Event-linked forms show on event detail page
- ✅ Form responses viewable by form creator and EC/Faculty/Admin
- ✅ Kick-off registrations sync correctly
- ✅ No duplicate submissions allowed
- ✅ Form response export to CSV works

## Part 8: Meeting Module

### 8.1 Meeting Creation Flow

**Step 1: Meeting Type**
- Ask: "Offline or Online?"

**If Offline**:
- Place (text input)
- Date (date picker)
- Time (time picker)
- About (textarea)
- Select Participants (multi-select from users)

**If Online**:
- Date (date picker)
- Time (time picker)
- About (textarea)
- Select Participants (multi-select from users)
- Integrate with Microsoft Teams API
- Auto-generate Teams meeting link

**Step 2: Email Generation**
- Auto-generate meeting invitation email
- Include: date, time, location/link, agenda, participants
- Send email to all selected participants

**Step 3: Calendar Integration**
- Meeting appears in dashboard calendar
- Participants see meeting in their calendar
- Reminder notifications 1 hour before meeting

**Acceptance Criteria**:
- ✅ Meeting creation wizard guides through steps
- ✅ Offline meetings save place, date, time
- ✅ Online meetings integrate with Microsoft Teams
- ✅ Teams link generated and stored
- ✅ Email sent to all participants
- ✅ Meeting appears in calendar view
- ✅ Participants can RSVP (accept/decline)
- ✅ Meeting reminders sent 1 hour before

### 8.2 Microsoft Teams Integration

**Requirements**:
- Use Microsoft Graph API
- OAuth authentication for Teams
- Create online meeting via API
- Store meeting link in database
- Include link in email invitation

**Acceptance Criteria**:
- ✅ Teams OAuth flow works correctly
- ✅ Meeting link generated successfully
- ✅ Link is valid and accessible to participants
- ✅ Meeting details sync to Teams calendar

## Part 9: Profile & Account Fixes

### 9.1 Profile Photo Upload

**Current Issue**: Photo upload not working, preview not showing

**Requirements**:
- Upload photo to Supabase Storage bucket `profile-photos`
- Store photo URL in `profiles.photo_url`
- Show photo preview after upload
- Support formats: JPG, PNG, WebP
- Max size: 5MB
- Auto-resize to 500x500px

**Acceptance Criteria**:
- ✅ Photo upload works from profile page
- ✅ Preview shows immediately after upload
- ✅ Photo appears in navigation bar
- ✅ Photo appears in chat messages
- ✅ Old photo deleted when new photo uploaded

### 9.2 Password Change Flow

**Current Issue**: Password change not working

**Requirements**:
- User can change own password
- Requires current password verification
- New password must meet requirements:
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
- Confirm password must match
- Success message after change

**Acceptance Criteria**:
- ✅ Current password verified before change
- ✅ Password requirements enforced
- ✅ Confirm password validation works
- ✅ Success message shown after change
- ✅ User can login with new password

### 9.3 Admin User Management

**Requirements**:
- Admin can change any user's password (without knowing current)
- Admin can change user's email
- Admin can update user's role
- Admin can deactivate user (soft delete)
- Admin can reactivate deactivated user
- All changes logged in `admin_actions` table

**Acceptance Criteria**:
- ✅ Admin sees user management interface
- ✅ Can search/filter users
- ✅ Can change password without current password
- ✅ Can update email (with validation)
- ✅ Can change role (dropdown with all roles)
- ✅ Can deactivate/reactivate users
- ✅ All actions logged with admin ID and timestamp
- ✅ Deactivated users cannot login

## Part 10: Role-Based Dashboard

### Dashboard Variations by Role

**Committee Member Dashboard**:
- Assigned tasks (with status)
- Upload documents section
- Committee chat access
- Personal chat access
- Upcoming committee events

**Co-Head Dashboard**:
- Propose event button
- Committee tasks overview
- Committee chat access
- Co-heads chat access
- Event proposals status

**Head Dashboard**:
- Approve co-head proposals
- Committee tasks overview
- EC progress view (read-only)
- Committee chat access
- Event management

**EC Member Dashboard**:
- Proposal voting queue
- Task approval queue
- Finance overview
- Executive chat access
- Organization-wide progress
- Meeting creation

**Faculty Dashboard**:
- All approvals (events, tasks, emails, posters, finance)
- Finance overview
- Progress tracking (all events)
- Kick-off control
- Meeting schedules
- Documents access

**Admin Dashboard**:
- System settings
- EC approval threshold configuration
- Role management
- User management
- Override controls
- Audit logs
- Database health

**Acceptance Criteria**:
- ✅ Dashboard content changes based on user role
- ✅ Unauthorized sections not visible
- ✅ Navigation menu adapts to role
- ✅ Quick actions relevant to role
- ✅ Dashboard loads in under 2 seconds
- ✅ Real-time data updates

## Part 11: Supabase Fixes

### 11.1 Edge Function Health

**Current Issue**: Edge functions showing as unhealthy

**Requirements**:
- Diagnose edge function errors
- Fix deployment issues
- Ensure functions respond within 10 seconds
- Add health check endpoints
- Monitor function logs

**Acceptance Criteria**:
- ✅ All edge functions show as healthy
- ✅ Functions respond within timeout
- ✅ Error logs are clear and actionable
- ✅ Health check endpoint returns 200 OK

### 11.2 RLS Policies

**Requirements**:
- RLS policies match role hierarchy
- No role can bypass hierarchy
- Policies enforce:
  - Committee members see only their committee data
  - Heads see their committee + approval queue
  - EC sees all committees + approval queues
  - Faculty sees everything (read-only except approvals)
  - Admin sees everything (full access)

**Tables Requiring RLS**:
- profiles
- events
- tasks
- task_updates
- documents
- chat_messages
- chat_groups
- form_responses
- kickoff_registrations
- pr_emails
- posters
- finance_transactions
- meetings
- approval_logs

**Acceptance Criteria**:
- ✅ All tables have RLS enabled
- ✅ Policies tested for each role
- ✅ No unauthorized data access possible
- ✅ Performance impact minimal (indexed columns)

### 11.3 Authentication & Role Linking

**Requirements**:
- Supabase Auth linked to profiles table
- User role stored in profiles.role
- Committee membership in committee_members table
- Executive role in profiles.executive_role
- Faculty flag in profiles.is_faculty
- Admin flag in profiles.is_admin

**Acceptance Criteria**:
- ✅ Auth user ID matches profile ID
- ✅ Role correctly set on user creation
- ✅ Role changes reflect immediately
- ✅ Committee membership tracked correctly

### 11.4 Approval Logs

**Requirements**:
- All approvals logged to `approval_logs` table
- Log fields:
  - id (UUID)
  - user_id (who approved)
  - role (user's role at time of approval)
  - entity_type (event/task/email/poster/finance)
  - entity_id (ID of approved item)
  - action (approve/reject/modify)
  - previous_status
  - new_status
  - reason (for rejections)
  - timestamp

**Acceptance Criteria**:
- ✅ All approval actions logged
- ✅ Logs immutable (no updates/deletes)
- ✅ Logs queryable by entity, user, date range
- ✅ Audit trail complete and accurate

## Security Rules

### Hierarchy Enforcement
- No role can bypass approval hierarchy
- Event: Co-head → Head → EC (2/6) → Faculty
- Task: EC (1/6) → Assigned Committee
- Email: PR → Faculty
- Poster: Graphics → Faculty
- Finance: EC → Faculty

### Approval Logging
- All approvals logged with full context
- Logs include user ID, role, timestamp, action
- Logs are immutable and auditable

### EC Approval Threshold
- Configurable from Admin Panel
- Default: 2/6 for events, 1/6 for tasks
- Changes logged in admin_actions

### Faculty Approval Mandatory
- Events cannot become active without faculty approval
- Emails cannot be sent without faculty approval
- Posters cannot be published without faculty approval
- Finance transactions require faculty approval

### Document Security
- Documents stored in Supabase Storage with proper bucket policies
- Access controlled by RLS policies
- Download logs tracked

### Chat Security
- Role-based chat access enforced
- EC chat only for EC members
- Co-heads chat only for co-heads
- Committee chats only for committee members
- Messages encrypted in transit

## Non-Functional Requirements

### Scalability
- System must handle 500+ concurrent users
- Database queries optimized with indexes
- Pagination for large lists (tasks, documents, messages)
- Lazy loading for images and documents

### Performance
- Dashboard loads in under 2 seconds
- Chat messages deliver in under 1 second
- File uploads complete in under 5 seconds (for 5MB files)
- Search results return in under 1 second

### Modularity
- Features organized in separate modules
- Shared utilities in lib/ folder
- Reusable components in components/ folder
- Clear separation of concerns

### Code Quality
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Unit tests for critical functions
- Integration tests for workflows

### Real-Time Updates
- Use Supabase Realtime for:
  - Chat messages
  - Task status updates
  - Approval notifications
  - Dashboard data
- Fallback to polling if Realtime unavailable

## Success Criteria

### Functional
- ✅ All 11 parts implemented and working
- ✅ All role-based permissions enforced
- ✅ All approval workflows functional
- ✅ All dashboards show correct data for each role
- ✅ Chat system works like WhatsApp
- ✅ Documents stored and filterable
- ✅ Meetings integrate with Teams
- ✅ Forms save and sync correctly
- ✅ Profile and account features work

### Security
- ✅ No role can bypass hierarchy
- ✅ All approvals logged
- ✅ RLS policies prevent unauthorized access
- ✅ Passwords meet security requirements
- ✅ Admin actions logged

### Performance
- ✅ Dashboard loads in under 2 seconds
- ✅ Chat messages deliver in under 1 second
- ✅ Search returns results in under 1 second
- ✅ System handles 500+ concurrent users

### Usability
- ✅ Intuitive navigation for each role
- ✅ Clear visual hierarchy
- ✅ Mobile-responsive design
- ✅ Helpful error messages
- ✅ Loading states for async operations

## Out of Scope

- Email server setup (use existing email service)
- SMS notifications
- Mobile native apps (web app only)
- Video conferencing (use Teams integration)
- Payment gateway integration
- External API integrations (except Teams)

## Dependencies

- Next.js 14+ with App Router
- Supabase (Database, Auth, Storage, Realtime)
- Microsoft Graph API (for Teams integration)
- Tailwind CSS for styling
- Framer Motion for animations
- React Hook Form for forms
- Zod for validation

## Estimated Effort

- Part 1 (Event Workflow): 2-3 hours (enhancement)
- Part 2 (Task System): 12-15 hours
- Part 3 (Faculty Dashboard): 8-10 hours
- Part 4 (PR & Graphics): 6-8 hours
- Part 5 (Social & Environmental): 8-10 hours
- Part 6 (Chat System): 20-25 hours
- Part 7 (Forms Fix): 4-6 hours
- Part 8 (Meetings): 10-12 hours
- Part 9 (Profile Fixes): 4-6 hours
- Part 10 (Role Dashboards): 15-20 hours
- Part 11 (Supabase Fixes): 6-8 hours

**Total: 95-123 hours (12-15 working days)**

## Implementation Strategy

Given the large scope, recommend phased implementation:

**Phase 1 (Critical)**: Parts 2, 3, 11 - Task system, Faculty dashboard, Supabase fixes
**Phase 2 (High Priority)**: Parts 4, 5, 7 - PR/Graphics control, Social/Environmental, Forms fix
**Phase 3 (Medium Priority)**: Parts 8, 9, 10 - Meetings, Profile fixes, Role dashboards
**Phase 4 (Enhancement)**: Part 6 - Chat system (most complex)

Each phase can be completed and deployed independently.
