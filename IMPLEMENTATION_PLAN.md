# IIChE Portal - Strict Role-Based Management System Implementation Plan

## Phase 1: Database Schema & Role System (Priority: CRITICAL)
- [ ] Create new role enum with all 6 roles
- [ ] Create approval_logs table
- [ ] Create task_assignments table with EC approval workflow
- [ ] Create document_uploads table with metadata
- [ ] Create chat_system tables (messages, groups, participants)
- [ ] Create meeting_system tables
- [ ] Create approval_workflow tables (PR, Graphics, Finance)
- [ ] Update RLS policies for strict role hierarchy

## Phase 2: Core Permission System (Priority: CRITICAL)
- [ ] Rewrite lib/permissions.ts with new role hierarchy
- [ ] Create role-based middleware
- [ ] Create approval workflow utilities
- [ ] Create document access control utilities

## Phase 3: Task Assignment System (Priority: HIGH)
- [ ] Task creation by proposed committee
- [ ] Task assignment to any committee
- [ ] EC approval workflow for tasks
- [ ] Task status updates by assigned committee
- [ ] Document upload with task updates
- [ ] Central documents tab with filters

## Phase 4: Faculty Dashboard (Priority: HIGH)
- [ ] Faculty-specific dashboard layout
- [ ] Finance overview widget
- [ ] Proposal approval interface
- [ ] Task progress tracking
- [ ] Email/Poster approval interface
- [ ] Read-only documents access

## Phase 5: PR & Graphics Approval Workflow (Priority: HIGH)
- [ ] PR email draft system
- [ ] Faculty approval for PR emails
- [ ] Graphics poster upload system
- [ ] Faculty approval for posters
- [ ] Approval status tracking

## Phase 6: Social & Environmental Committee Controls (Priority: MEDIUM)
- [ ] Kick-off toggle control
- [ ] Registration link generation
- [ ] Registration approval workflow
- [ ] Schedule visibility control
- [ ] Schedule modification interface

## Phase 7: Enhanced Chat System (Priority: MEDIUM)
- [ ] Personal 1-to-1 chat
- [ ] Committee group chats
- [ ] Organization-wide chat
- [ ] EC-only chat
- [ ] Co-heads chat
- [ ] Custom group creation
- [ ] File sharing in chat
- [ ] Seen status & typing indicators
- [ ] Role-based chat access control

## Phase 8: Forms Integration Fix (Priority: MEDIUM)
- [ ] Fix form submission storage
- [ ] Fix event-form mapping
- [ ] Sync registration data with kick-off

## Phase 9: Meeting Module Enhancement (Priority: MEDIUM)
- [ ] Offline/Online meeting type selection
- [ ] Microsoft Teams integration
- [ ] Auto-generate meeting emails
- [ ] Calendar integration
- [ ] Participant selection interface

## Phase 10: Profile & Account Management (Priority: LOW)
- [ ] Fix profile photo upload
- [ ] Fix password change flow
- [ ] Admin user management interface
- [ ] User deactivation feature

## Phase 11: Role-Based Dashboards (Priority: HIGH)
- [ ] Committee Member dashboard
- [ ] Co-Head dashboard
- [ ] Head dashboard
- [ ] EC Member dashboard
- [ ] Faculty dashboard
- [ ] Admin dashboard

## Phase 12: Security & Logging (Priority: CRITICAL)
- [ ] Approval logging system
- [ ] Role hierarchy enforcement
- [ ] Document security policies
- [ ] Chat access restrictions
- [ ] Audit trail implementation

## Phase 13: Supabase Fixes (Priority: CRITICAL)
- [ ] Fix Edge Function health
- [ ] Update RLS policies
- [ ] Fix authentication-role linking
- [ ] Implement approval logs storage

---

## Implementation Order:
1. Phase 1 (Database Schema)
2. Phase 2 (Permission System)
3. Phase 13 (Supabase Fixes)
4. Phase 3 (Task Assignment)
5. Phase 4 (Faculty Dashboard)
6. Phase 5 (PR & Graphics)
7. Phase 11 (Role-Based Dashboards)
8. Phase 6, 7, 8, 9, 10 (Remaining features)
9. Phase 12 (Final Security Audit)

---

## Estimated Timeline:
- Critical phases: 3-4 days
- High priority: 2-3 days
- Medium priority: 2-3 days
- Low priority: 1 day
- Testing & refinement: 2 days

**Total: ~10-13 days**
