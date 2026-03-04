# Implementation Plan: Approval Workflow Updates

## Overview

This implementation plan breaks down the approval workflow updates into discrete coding tasks. The feature updates the event and task approval workflow to require 2/6 EC approvals for events and 1/6 EC approval for tasks, while improving visibility and faculty approval capabilities.

Key changes:
- Update approval threshold logic (2/6 for events, 1/6 for tasks)
- Enable EC read-only visibility at pending_head_approval stage
- Enhance faculty dashboard with prominent pending approvals
- Filter progress calculations to exclude pending/rejected tasks

## Tasks

- [x] 1. Update approval workflow utilities
  - [x] 1.1 Update event EC approval threshold logic
    - Modify `approveEventAsEC` function to check for 2 approvals instead of 6
    - Update status transition to `pending_faculty_approval` when threshold reached
    - Ensure approval records are upserted correctly to handle duplicate approvals
    - Add validation for EC role permissions
    - _Requirements: US-2.3, CP-1_
  
  - [ ]* 1.2 Write property test for event approval threshold
    - **Property 3: Event Approval Threshold**
    - **Validates: Requirements US-2.3, CP-1**
    - Generate random events and EC approvals to verify threshold behavior
    - Test that status transitions at exactly 2 approvals
  
  - [x] 1.3 Implement task EC approval function
    - Create `approveTaskAsEC` function with 1-approval threshold
    - Update task status to `not_started` on single EC approval
    - Record EC approver ID and timestamp
    - Add validation for EC role permissions
    - _Requirements: US-4.3, CP-2_
  
  - [ ]* 1.4 Write property test for task approval threshold
    - **Property 9: Task Approval Threshold**
    - **Validates: Requirements US-4.3, CP-2**
    - Generate random tasks and verify single approval transitions status
  
  - [x] 1.5 Add faculty approval function
    - Implement `approveEventAsFaculty` function
    - Transition event status to `active` on faculty approval
    - Record faculty approver ID and timestamp
    - Add rejection handling with required reason
    - _Requirements: US-3.2, US-3.3_
  
  - [ ]* 1.6 Write property test for faculty approval
    - **Property 7: Faculty Approval Transition**
    - **Validates: Requirements US-3.3**
    - Verify status transitions and field updates on faculty approval
  
  - [x] 1.7 Add comprehensive approval action logging
    - Ensure all approval functions log to `approval_logs` table
    - Include user ID, role, action, entity type/ID, status changes, timestamp
    - _Requirements: Security audit logging_

- [ ] 2. Checkpoint - Verify approval workflow utilities
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update proposals page for EC visibility and approval
  - [x] 3.1 Update event query logic for EC members
    - Modify query to include `pending_head_approval` status for EC members
    - Ensure EC members can view events at this stage
    - Maintain existing visibility rules for other statuses
    - _Requirements: US-1.1_
  
  - [ ]* 3.2 Write property test for EC read-only visibility
    - **Property 1: EC Read-Only Visibility at Pending Head Approval**
    - **Validates: Requirements US-1.1, US-1.2, US-1.4**
    - Generate random events and EC users to verify visibility rules
  
  - [x] 3.3 Add read-only UI state for pending_head_approval
    - Disable approve button when event is at `pending_head_approval`
    - Add tooltip explaining "Waiting for head approval"
    - Show event details in read-only mode
    - _Requirements: US-1.2_
  
  - [x] 3.4 Update approval count display
    - Change approval progress display from "X/6" to "X/2"
    - Update progress bar to reflect 2-approval threshold
    - Show list of EC members who have approved
    - _Requirements: US-2.2, US-2.4_
  
  - [ ]* 3.5 Write property test for approval display accuracy
    - **Property 2: EC Approval Display Accuracy**
    - **Validates: Requirements US-2.2, US-2.4**
    - Verify displayed count matches database records
  
  - [x] 3.6 Update handleECApprove function
    - Update threshold check to use 2 approvals
    - Call updated `approveEventAsEC` from approval-workflow.ts
    - Handle success/error states with appropriate messages
    - Refresh approval list after action
    - _Requirements: US-2.1, US-2.3_
  
  - [ ]* 3.7 Write property test for EC approval action availability
    - **Property 4: EC Approval Action Availability**
    - **Validates: Requirements US-2.1**
    - Verify approval actions available to EC members who haven't approved

- [ ] 4. Checkpoint - Verify proposals page updates
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update faculty dashboard for prominent approvals
  - [x] 5.1 Add pending approvals section at dashboard top
    - Create dedicated section for events at `pending_faculty_approval`
    - Query events with this status for faculty users
    - Display section prominently above other dashboard content
    - _Requirements: US-3.1_
  
  - [ ]* 5.2 Write property test for faculty visibility rules
    - **Property 5: Faculty Visibility Rules**
    - **Validates: Requirements US-3.1**
    - Verify faculty queries return only pending_faculty_approval events
  
  - [x] 5.3 Create event approval cards with details
    - Display event title, committee, date, budget
    - Show approval history (head approval, EC approvals)
    - Add approve and reject action buttons
    - _Requirements: US-3.2_
  
  - [x] 5.4 Implement inline approve/reject actions
    - Add approve button that calls faculty approval function
    - Add reject button with required reason input field
    - Validate rejection reason is non-empty
    - Show success/error messages
    - _Requirements: US-3.2_
  
  - [ ]* 5.5 Write property test for faculty approval actions
    - **Property 6: Faculty Approval Actions**
    - **Validates: Requirements US-3.2**
    - Verify approve/reject actions available and rejection requires reason
  
  - [ ]* 5.6 Write property test for active event visibility
    - **Property 8: Active Event Visibility**
    - **Validates: Requirements US-3.4**
    - Verify active events visible to all user roles

- [x] 6. Update progress tracking to filter pending tasks
  - [x] 6.1 Update getCommitteeTaskSummary function
    - Filter out tasks with status `pending_ec_approval`
    - Filter out tasks with status `ec_rejected`
    - Include only `not_started`, `in_progress`, and `completed` tasks
    - _Requirements: US-5.4_
  
  - [ ]* 6.2 Write property test for progress calculation accuracy
    - **Property 13: Progress Calculation Accuracy**
    - **Validates: Requirements US-5.4**
    - Generate random task sets and verify progress excludes pending/rejected
  
  - [x] 6.3 Add task approval status indicators
    - Show EC approval status on task cards
    - Add visual distinction for pending vs approved tasks
    - Display EC approver name and timestamp for approved tasks
    - _Requirements: US-4.4_
  
  - [ ]* 6.4 Write property test for task visibility after approval
    - **Property 10: Task Visibility After Approval**
    - **Validates: Requirements US-4.4**
    - Verify approved tasks appear in committee queries
  
  - [x] 6.5 Add filter toggle for pending tasks
    - Create UI toggle to show/hide pending tasks
    - Default to hiding pending tasks in progress view
    - Allow users to view pending tasks when needed
    - _Requirements: US-4.4_
  
  - [ ]* 6.6 Write property test for task status transitions
    - **Property 11: Task Status Transitions**
    - **Validates: Requirements US-5.1**
    - Verify valid status transition sequence
  
  - [ ]* 6.7 Write property test for task update creation
    - **Property 12: Task Update Creation**
    - **Validates: Requirements US-5.2, US-5.3**
    - Verify committee members can create updates with text and documents

- [ ] 7. Checkpoint - Verify progress tracking updates
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add comprehensive testing coverage
  - [ ]* 8.1 Write unit tests for approval-workflow.ts
    - Test `approveEventAsEC` with various approval counts
    - Test `approveTaskAsEC` single approval behavior
    - Test `approveEventAsFaculty` status transition
    - Test permission validation for all functions
    - Test error handling for invalid inputs
  
  - [ ]* 8.2 Write unit tests for proposals page
    - Test EC member can view pending_head_approval events
    - Test approval button disabled at pending_head_approval
    - Test approval count displays correctly (X/2)
    - Test list of approvers displays correctly
    - Test status transitions after threshold reached
  
  - [ ]* 8.3 Write unit tests for faculty dashboard
    - Test pending approvals section displays events
    - Test approve button triggers correct API call
    - Test reject button requires reason input
    - Test success/error messages display correctly
  
  - [ ]* 8.4 Write unit tests for progress page
    - Test progress calculation excludes pending tasks
    - Test progress calculation excludes rejected tasks
    - Test task status updates trigger progress recalculation
    - Test committee task summary groups correctly
  
  - [ ]* 8.5 Write property test for student visibility rules
    - **Property 14: Student Visibility Rules**
    - **Validates: Requirements CP-3.4**
    - Verify students see only active events
  
  - [ ]* 8.6 Create test data generators
    - Implement event generator with random valid data
    - Implement EC member generator with executive roles
    - Implement task generator with various statuses
    - Configure fast-check with 100+ iterations per property test
  
  - [ ]* 8.7 Write integration test for end-to-end approval flow
    - Test complete flow: proposal → head → EC (2) → faculty → active
    - Verify status transitions at each stage
    - Verify visibility rules at each stage
    - Verify approval counts and records
  
  - [ ]* 8.8 Write integration test for task approval flow
    - Test flow: pending_ec_approval → not_started → in_progress → completed
    - Verify single EC approval transitions to not_started
    - Verify progress bar updates after status changes

- [ ] 9. Final checkpoint - Comprehensive testing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add inline documentation and comments
  - [x] 10.1 Document approval threshold changes
    - Add comments explaining 2/6 threshold for events
    - Add comments explaining 1/6 threshold for tasks
    - Document rationale for threshold values
  
  - [x] 10.2 Document visibility rules
    - Add comments explaining EC read-only access at pending_head_approval
    - Document role-based visibility filtering logic
    - Explain status-based access control
  
  - [x] 10.3 Add JSDoc comments to approval functions
    - Document function parameters and return types
    - Explain error conditions and validation rules
    - Add usage examples for key functions

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across random inputs
- Unit tests validate specific examples and edge cases
- No database schema changes required - all changes are code-only
- Estimated total effort: 16-23 hours across all phases
- Implementation uses TypeScript with Next.js and Supabase
