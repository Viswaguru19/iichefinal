# Implementation Plan: Role-Based System Overhaul

## Overview

This implementation plan breaks down the comprehensive role-based system overhaul into discrete, actionable tasks organized by phase. The system covers 11 major parts with an estimated 95-123 hours of work.

## Implementation Strategy

**Phased Approach**:
- Phase 1 (Critical): Parts 2, 3, 11 - Foundation
- Phase 2 (High): Parts 4, 5, 7 - Core Features
- Phase 3 (Medium): Parts 8, 9, 10 - Enhancements
- Phase 4 (Advanced): Part 6 - Chat System

## Phase 1: Critical Foundation (25-30 hours)

### Part 11: Supabase Fixes (6-8 hours)

- [ ] 1. Fix Supabase edge function health
  - [ ] 1.1 Diagnose edge function errors
    - Check edge function logs in Supabase dashboard
    - Identify timeout or deployment issues
    - Review function code for errors
  
  - [ ] 1.2 Add health check endpoints
    - Create `/api/health` endpoint
    - Return database connection status
    - Return auth service status
    - Return storage service status
  
  - [ ] 1.3 Fix deployment issues
    - Update edge function configuration
    - Ensure proper environment variables
    - Test function invocation
    - Verify response times under 10 seconds

- [ ] 2. Implement comprehensive RLS policies
  - [ ] 2.1 Create RLS policies for profiles table
    - Users can view their own profile
    - EC/Faculty/Admin can view all profiles
    - Only admin can update roles
  
  - [ ] 2.2 Create RLS policies for tasks table
    - Committee members see assigned tasks
    - EC sees all tasks
    - Task creators see their tasks
    - Faculty/Admin see all tasks
  
  - [ ] 2.3 Create RLS policies for documents table
    - Uploaders see their documents
    - Committee members see committee documents
    - EC/Faculty/Admin see all documents
  
  - [ ] 2.4 Create RLS policies for chat tables
    - Group members see group messages
    - EC chat only for EC members
    - Co-heads chat only for co-heads
  
  - [ ] 2.5 Test RLS policies for each role
    - Test as committee member
    - Test as co-head
    - Test as head
    - Test as EC member
    - Test as faculty
    - Test as admin

- [ ] 3. Ensure auth and profile linking
  - [ ] 3.1 Create trigger for new user profile creation
    - Auto-create profile on auth.users insert
    - Set default values
    - Link auth.uid to profile.id
  
  - [ ] 3.2 Verify role fields in profiles
    - executive_role column exists
    - is_faculty column exists
    - is_admin column exists
  
  - [ ] 3.3 Test authentication flow
    - Sign up creates profile
    - Login returns correct user data
    - Role changes reflect immediately

- [ ] 4. Create approval and admin logs tables
  - [ ] 4.1 Create approval_logs table
    - Add all required columns
    - Add indexes for performance
    - Enable RLS (read-only for non-admins)
  
  - [ ] 4.2 Create admin_actions table
    - Add all required columns
    - Add indexes
    - Enable RLS (admin-only)
  
  - [ ] 4.3 Create logging utility functions
    - logApproval() function
    - logAdminAction() function
    - Test logging from different contexts

- [ ] 5. Checkpoint - Verify Supabase foundation
  - Ensure all tests pass, ask the user if questions arise.

### Part 2: Task Assignment System (12-15 hours)

- [ ] 6. Create task data model enhancements
  - [ ] 6.1 Add new columns to tasks table
    - ec_approved_by
    - ec_approved_at
    - ec_rejection_reason
    - ec_modified_fields (JSONB)
    - priority
  
  - [ ] 6.2 Create task_updates table
    - All required columns
    - Foreign keys
    - Indexes
  
  - [ ] 6.3 Update task status enum
    - Add pending_ec_approval
    - Add ec_rejected
    - Add partially_completed

- [ ] 7. Build task creation interface
  - [ ] 7.1 Create TaskForm component
    - Event selection dropdown
    - Title input
    - Description textarea
    - Committee assignment dropdown
    - Deadline date picker
    - Priority selector
    - Document upload
  
  - [ ] 7.2 Create task creation page
    - Use TaskForm component
    - Handle form submission
    - Upload documents to storage
    - Create task record
    - Show success/error messages
  
  - [ ] 7.3 Implement createTask utility
    - Validate user permissions
    - Upload documents first
    - Insert task with status pending_ec_approval
    - Store document records
    - Return created task

- [ ] 8. Build EC task approval interface
  - [ ] 8.1 Create task approval page
    - Query tasks with pending_ec_approval status
    - Display task cards with details
    - Show event, committee, creator info
  
  - [ ] 8.2 Create TaskApprovalCard component
    - Display task details
    - Approve button
    - Modify button
    - Reject button with reason input
  
  - [ ] 8.3 Create TaskEditModal component
    - Pre-fill with current task data
    - Allow editing title, description, deadline, committee
    - Save and approve button
  
  - [ ] 8.4 Implement approval utility functions
    - approveTask() - single EC approval
    - modifyAndApproveTask() - edit then approve
    - rejectTask() - reject with reason
    - All functions log to approval_logs

- [ ] 9. Build task execution interface
  - [ ] 9.1 Create task detail page
    - Display full task information
    - Show status with color coding
    - Display assigned committee
    - Show deadline
  
  - [ ] 9.2 Create task status update component
    - Dropdown with valid status transitions
    - Update button
    - Confirmation dialog
  
  - [ ] 9.3 Create task updates section
    - List all updates chronologically
    - Show user name and timestamp
    - Display attached documents
  
  - [ ] 9.4 Create task update form
    - Textarea for update text
    - File upload for documents
    - Submit button
  
  - [ ] 9.5 Implement task update utilities
    - updateTaskStatus() function
    - createTaskUpdate() function
    - Upload documents to storage

- [ ] 10. Build central documents repository
  - [ ] 10.1 Create documents table
    - All required columns
    - Indexes for filtering
    - RLS policies
  
  - [ ] 10.2 Create documents page
    - Grid/list view toggle
    - Filter sidebar
    - Search bar
  
  - [ ] 10.3 Create DocumentFilters component
    - Year dropdown
    - Month dropdown
    - Event dropdown
    - Committee dropdown
    - Task dropdown
    - Uploaded by dropdown
  
  - [ ] 10.4 Create DocumentCard component
    - Thumbnail preview
    - Filename
    - Metadata (size, date, uploader)
    - Download button
    - View button
  
  - [ ] 10.5 Implement document utilities
    - uploadDocument() function
    - fetchDocuments() with filters
    - downloadDocument() function

- [ ] 11. Checkpoint - Verify task system
  - Ensure all tests pass, ask the user if questions arise.

### Part 3: Faculty Dashboard (8-10 hours)

- [ ] 12. Build faculty dashboard layout
  - [ ] 12.1 Create faculty dashboard page
    - Grid layout for 8 sections
    - Real-time data loading
    - Supabase Realtime subscriptions
  
  - [ ] 12.2 Create FacultyHeader component
    - Welcome message
    - Quick stats
    - Navigation links

- [ ] 13. Implement dashboard sections
  - [ ] 13.1 Create FinanceOverviewWidget
    - Query finance transactions
    - Calculate totals (income, expense, balance)
    - Display pending approvals count
    - Show charts/graphs
  
  - [ ] 13.2 Create UpcomingEventsWidget
    - Query next 5 events
    - Display event cards
    - Show dates and status
    - Quick links to event details
  
  - [ ] 13.3 Create PendingApprovalsSection
    - Query events at pending_faculty_approval
    - Query pending emails
    - Query pending posters
    - Display approval cards
    - Inline approve/reject actions
  
  - [ ] 13.4 Create TaskProgressWidget
    - Query all active events
    - Calculate task completion per event
    - Display progress bars
    - Show committee-wise breakdown
  
  - [ ] 13.5 Create KickOffStatusWidget
    - Query kickoff settings
    - Show registration status (open/closed)
    - Display registration count
    - Show approval status
  
  - [ ] 13.6 Create MeetingSchedulesWidget
    - Query upcoming meetings
    - Display calendar view
    - Show meeting details
    - RSVP status
  
  - [ ] 13.7 Create QuickApprovalsWidget
    - Pending emails list
    - Pending posters list
    - Quick approve/reject buttons
  
  - [ ] 13.8 Create DocumentsAccessWidget
    - Link to documents page
    - Recent documents list
    - Quick search

- [ ] 14. Implement approval actions
  - [ ] 14.1 Create approval utility functions
    - approveEvent() for faculty
    - approveEmail() for faculty
    - approvePoster() for faculty
    - approveFinance() for faculty
    - All functions log approvals
  
  - [ ] 14.2 Add real-time updates
    - Subscribe to events table changes
    - Subscribe to pr_emails table changes
    - Subscribe to posters table changes
    - Update UI on changes

- [ ] 15. Checkpoint - Verify faculty dashboard
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Core Features (18-24 hours)

### Part 4: PR & Graphics Control (6-8 hours)

- [ ] 16. Build PR email workflow
  - [ ] 16.1 Create pr_emails table
    - All required columns
    - Status enum
    - Indexes
  
  - [ ] 16.2 Create PR emails page
    - List all emails
    - Filter by status
    - New draft button
  
  - [ ] 16.3 Create EmailDraftModal component
    - Event selection
    - Subject input
    - Body rich text editor
    - Recipients multi-select
    - Save draft button
  
  - [ ] 16.4 Create EmailCard component
    - Display email details
    - Status badge
    - Submit for approval button (for drafts)
    - Send button (for approved)
    - Edit button (for drafts)
  
  - [ ] 16.5 Implement email utilities
    - createEmailDraft() function
    - submitForApproval() function
    - sendEmail() function (calls edge function)
  
  - [ ] 16.6 Create email sending edge function
    - Accept emailId parameter
    - Fetch email details
    - Send via email service
    - Update status to sent

- [ ] 17. Build poster approval workflow
  - [ ] 17.1 Create posters table
    - All required columns
    - Status enum
    - Indexes
  
  - [ ] 17.2 Create posters page
    - Grid view of posters
    - Filter by event
    - Upload button
  
  - [ ] 17.3 Create PosterUploadZone component
    - Drag and drop area
    - File input
    - Event selection
    - Upload progress
  
  - [ ] 17.4 Create PosterCard component
    - Poster thumbnail
    - Event name
    - Status badge
    - Approve/reject buttons (for faculty)
  
  - [ ] 17.5 Implement poster utilities
    - uploadPoster() function
    - approvePoster() function
    - rejectPoster() function

- [ ] 18. Checkpoint - Verify PR & Graphics control
  - Ensure all tests pass, ask the user if questions arise.

### Part 5: Social & Environmental Control (8-10 hours)

- [ ] 19. Build kickoff registration control
  - [ ] 19.1 Create kickoff_settings table
    - event_id
    - enabled boolean
    - registration_link
  
  - [ ] 19.2 Create kickoff control page
    - Toggle switch for registration
    - Registration link display
    - Copy link button
    - Registrations list
  
  - [ ] 19.3 Implement toggle functionality
    - Update kickoff_settings on toggle
    - Generate registration link when enabled
    - Disable link when toggled off
  
  - [ ] 19.4 Create registration form page
    - Check if registration enabled
    - Display form if enabled
    - Show closed message if disabled
  
  - [ ] 19.5 Create RegistrationForm component
    - Name input
    - Email input
    - Roll number input
    - Year dropdown
    - Branch dropdown
    - Submit button
  
  - [ ] 19.6 Implement registration submission
    - Validate form data
    - Check for duplicates
    - Insert with pending_approval status
    - Show success message

- [ ] 20. Build registration approval interface
  - [ ] 20.1 Create registration approvals page
    - Query pending registrations
    - Display in table format
    - Bulk selection checkboxes
  
  - [ ] 20.2 Create RegistrationTable component
    - Sortable columns
    - Selection checkboxes
    - Approve/reject actions per row
    - Bulk approve button
  
  - [ ] 20.3 Implement approval functions
    - approveRegistration() function
    - bulkApproveRegistrations() function
    - rejectRegistration() function with reason

- [ ] 21. Build schedule management
  - [ ] 21.1 Create kickoff_schedules table
    - event_id
    - schedule_data (JSONB)
    - version
    - status
  
  - [ ] 21.2 Create schedule management page
    - View current schedule
    - Edit button
    - Version history
  
  - [ ] 21.3 Create ScheduleEditor component
    - Date/time inputs
    - Venue input
    - Agenda textarea
    - Sessions array (add/remove)
    - Save button
  
  - [ ] 21.4 Create ScheduleViewer component
    - Display schedule in readable format
    - Show all sessions
    - Highlight current/upcoming sessions
  
  - [ ] 21.5 Implement schedule utilities
    - saveSchedule() function
    - Auto-approve for Environmental committee
    - Increment version number

- [ ] 22. Checkpoint - Verify Social & Environmental control
  - Ensure all tests pass, ask the user if questions arise.

### Part 7: Forms Integration Fix (4-6 hours)

- [ ] 23. Fix forms data model
  - [ ] 23.1 Review form_responses table schema
    - Ensure form_id foreign key exists
    - Ensure user_id foreign key exists
    - Add unique constraint (form_id, user_id)
  
  - [ ] 23.2 Add event linking to forms
    - Add event_id column to forms table
    - Create foreign key to events
  
  - [ ] 23.3 Create form-kickoff sync
    - Trigger on kickoff_registrations insert
    - Create corresponding form_response
    - Keep data in sync

- [ ] 24. Fix form submission flow
  - [ ] 24.1 Update form submission handler
    - Check for duplicate submissions
    - Validate all required fields
    - Store responses as JSONB
  
  - [ ] 24.2 Fix event-linked forms display
    - Query forms by event_id
    - Display on event detail page
    - Show response count
  
  - [ ] 24.3 Create form responses viewer
    - Display all responses for a form
    - Filter by date
    - Export to CSV

- [ ] 25. Checkpoint - Verify forms integration
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Enhancements (27-36 hours)

### Part 8: Meeting Module (10-12 hours)

- [ ] 26. Create meeting data model
  - [ ] 26.1 Create meetings table
  - [ ] 26.2 Create meeting_participants table
  - [ ] 26.3 Add indexes

- [ ] 27. Build meeting creation wizard
  - [ ] 27.1 Create meeting type selection step
  - [ ] 27.2 Create offline meeting form
  - [ ] 27.3 Create online meeting form
  - [ ] 27.4 Create participant selection component
  - [ ] 27.5 Implement wizard navigation

- [ ] 28. Integrate Microsoft Teams
  - [ ] 28.1 Set up Microsoft Graph API credentials
  - [ ] 28.2 Implement OAuth flow
  - [ ] 28.3 Create Teams meeting via API
  - [ ] 28.4 Store meeting link
  - [ ] 28.5 Handle API errors

- [ ] 29. Build meeting email generation
  - [ ] 29.1 Create email template
  - [ ] 29.2 Generate email content
  - [ ] 29.3 Send to participants
  - [ ] 29.4 Log email sending

- [ ] 30. Build meeting calendar view
  - [ ] 30.1 Create calendar component
  - [ ] 30.2 Display meetings on calendar
  - [ ] 30.3 Add RSVP functionality
  - [ ] 30.4 Show meeting details on click

- [ ] 31. Checkpoint - Verify meeting module
  - Ensure all tests pass, ask the user if questions arise.

### Part 9: Profile & Account Fixes (4-6 hours)

- [ ] 32. Fix profile photo upload
  - [ ] 32.1 Create profile-photos storage bucket
  - [ ] 32.2 Implement photo upload function
  - [ ] 32.3 Add photo preview
  - [ ] 32.4 Update profile.photo_url
  - [ ] 32.5 Delete old photo on new upload

- [ ] 33. Fix password change flow
  - [ ] 33.1 Create password change form
  - [ ] 33.2 Verify current password
  - [ ] 33.3 Validate new password requirements
  - [ ] 33.4 Update password via Supabase Auth
  - [ ] 33.5 Show success message

- [ ] 34. Build admin user management
  - [ ] 34.1 Create user management page
  - [ ] 34.2 Add user search/filter
  - [ ] 34.3 Implement change password (admin)
  - [ ] 34.4 Implement change email
  - [ ] 34.5 Implement change role
  - [ ] 34.6 Implement deactivate/reactivate user
  - [ ] 34.7 Log all admin actions

- [ ] 35. Checkpoint - Verify profile & account fixes
  - Ensure all tests pass, ask the user if questions arise.

### Part 10: Role-Based Dashboards (15-20 hours)

- [ ] 36. Create dynamic dashboard system
  - [ ] 36.1 Create RoleDashboard component
  - [ ] 36.2 Implement role detection
  - [ ] 36.3 Render appropriate dashboard based on role

- [ ] 37. Build committee member dashboard
  - [ ] 37.1 Assigned tasks widget
  - [ ] 37.2 Upload documents section
  - [ ] 37.3 Committee chat access
  - [ ] 37.4 Upcoming committee events

- [ ] 38. Build co-head dashboard
  - [ ] 38.1 Propose event button
  - [ ] 38.2 Committee tasks overview
  - [ ] 38.3 Event proposals status
  - [ ] 38.4 Co-heads chat access

- [ ] 39. Build head dashboard
  - [ ] 39.1 Approve co-head proposals section
  - [ ] 39.2 Committee tasks overview
  - [ ] 39.3 EC progress view (read-only)
  - [ ] 39.4 Event management

- [ ] 40. Build EC member dashboard
  - [ ] 40.1 Proposal voting queue
  - [ ] 40.2 Task approval queue
  - [ ] 40.3 Finance overview
  - [ ] 40.4 Executive chat access
  - [ ] 40.5 Organization-wide progress

- [ ] 41. Build admin dashboard
  - [ ] 41.1 System settings section
  - [ ] 41.2 EC approval threshold config
  - [ ] 41.3 Role management
  - [ ] 41.4 User management
  - [ ] 41.5 Override controls
  - [ ] 41.6 Audit logs viewer
  - [ ] 41.7 Database health monitor

- [ ] 42. Implement role-based navigation
  - [ ] 42.1 Create dynamic navigation menu
  - [ ] 42.2 Show/hide menu items based on role
  - [ ] 42.3 Add role-specific quick actions

- [ ] 43. Checkpoint - Verify role-based dashboards
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Advanced Features (20-25 hours)

### Part 6: Chat System (20-25 hours)

- [ ] 44. Create chat data model
  - [ ] 44.1 Create chat_groups table
  - [ ] 44.2 Create chat_members table
  - [ ] 44.3 Create chat_messages table
  - [ ] 44.4 Create chat_message_reads table
  - [ ] 44.5 Add all indexes

- [ ] 45. Build chat infrastructure
  - [ ] 45.1 Set up Supabase Realtime channels
  - [ ] 45.2 Create chat utility functions
  - [ ] 45.3 Implement message sending
  - [ ] 45.4 Implement message receiving
  - [ ] 45.5 Handle connection/disconnection

- [ ] 46. Create auto-generated chat groups
  - [ ] 46.1 Create committee chats (one per committee)
  - [ ] 46.2 Create organization-wide chat
  - [ ] 46.3 Create executive committee chat
  - [ ] 46.4 Create co-heads chat
  - [ ] 46.5 Add members to appropriate groups

- [ ] 47. Build chat list interface
  - [ ] 47.1 Create chat list page
  - [ ] 47.2 Display all accessible chats
  - [ ] 47.3 Show last message preview
  - [ ] 47.4 Show unread count badge
  - [ ] 47.5 Implement search
  - [ ] 47.6 Add pin/archive functionality

- [ ] 48. Build chat conversation interface
  - [ ] 48.1 Create chat conversation page
  - [ ] 48.2 Display messages chronologically
  - [ ] 48.3 Implement message pagination
  - [ ] 48.4 Auto-scroll to bottom
  - [ ] 48.5 Load more on scroll up

- [ ] 49. Implement chat features
  - [ ] 49.1 Create MessageBubble component
  - [ ] 49.2 Add timestamp display
  - [ ] 49.3 Implement seen status (blue checkmarks)
  - [ ] 49.4 Add typing indicator
  - [ ] 49.5 Implement file upload
  - [ ] 49.6 Add message reactions
  - [ ] 49.7 Implement reply to message
  - [ ] 49.8 Add edit message (15 min window)
  - [ ] 49.9 Add delete message

- [ ] 50. Build custom group creation
  - [ ] 50.1 Create new group modal
  - [ ] 50.2 Group name input
  - [ ] 50.3 Member selection
  - [ ] 50.4 Create group function
  - [ ] 50.5 Add/remove members (admin only)

- [ ] 51. Implement real-time features
  - [ ] 51.1 Real-time message delivery
  - [ ] 51.2 Real-time typing indicator
  - [ ] 51.3 Real-time read receipts
  - [ ] 51.4 Real-time presence (online/offline)

- [ ] 52. Checkpoint - Verify chat system
  - Ensure all tests pass, ask the user if questions arise.

## Final Tasks

- [ ] 53. Comprehensive testing
  - [ ] 53.1 Test all role permissions
  - [ ] 53.2 Test all approval workflows
  - [ ] 53.3 Test real-time features
  - [ ] 53.4 Test on mobile devices
  - [ ] 53.5 Performance testing (500+ users)

- [ ] 54. Documentation
  - [ ] 54.1 User documentation for each role
  - [ ] 54.2 Admin documentation
  - [ ] 54.3 API documentation
  - [ ] 54.4 Deployment guide

- [ ] 55. Final checkpoint
  - Ensure all features working, ask the user for final review.

## Notes

- Each phase can be deployed independently
- Use feature flags for gradual rollout
- Monitor performance and errors after each phase
- Gather user feedback between phases
- Estimated total: 95-123 hours across 4 phases
