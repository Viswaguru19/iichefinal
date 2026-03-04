# Implementation Plan: WhatsApp-like Interactive Chat System

## Overview

This implementation plan breaks down the WhatsApp-like chat system into discrete, actionable coding tasks. The plan follows a phased approach starting with database schema, then backend APIs, followed by UI components, and finally advanced features and optimizations.

**Estimated Total Effort**: 6-8 weeks (240-320 hours)

**Key Principles**:
- Build incrementally with working features at each phase
- Test each component before moving to next
- Prioritize core messaging before advanced features
- Maintain security and performance throughout

## Phase 1: Database Schema and Migrations (Week 1) ✅ COMPLETED

### Task 1.1: Create Enhanced Chat Messages Table ✅
**Effort**: 2 hours | **Status**: COMPLETED
**Migration**: `026_enhance_chat_messages.sql`

Added columns to chat_messages table:
- `file_name TEXT` - Original filename for uploads
- `file_size INTEGER` - File size in bytes
- `is_edited BOOLEAN DEFAULT FALSE` - Edit flag
- `edited_at TIMESTAMPTZ` - Edit timestamp
- `is_pinned BOOLEAN DEFAULT FALSE` - Pin flag
- `pinned_by UUID REFERENCES profiles(id)` - Who pinned
- `pinned_at TIMESTAMPTZ` - Pin timestamp

### Task 1.2: Create Message Reactions Table ✅
**Effort**: 1.5 hours | **Status**: COMPLETED
**Migration**: `027_create_message_reactions.sql`

Created message_reactions table with:
- Unique constraint (message_id, user_id)
- Indexes for performance
- RLS policies

### Task 1.3: Create Message Read Status Table Enhancement ✅
**Effort**: 1.5 hours | **Status**: COMPLETED
**Migration**: `028_enhance_message_read_status.sql`

Added `delivered_at` column to message_read_status table for separate delivery tracking.

### Task 1.4: Create Message Forwards Tracking Table ✅
**Effort**: 1 hour | **Status**: COMPLETED
**Migration**: `029_create_message_forwards.sql`

Created message_forwards table to track forwarded messages.

### Task 1.5: Enhance Chat Groups Table ✅
**Effort**: 1 hour | **Status**: COMPLETED
**Migration**: `030_enhance_chat_groups.sql`

Added mute functionality columns:
- `is_muted BOOLEAN DEFAULT FALSE`
- `muted_until TIMESTAMPTZ`

### Task 1.6: Create System Chat Groups ✅
**Effort**: 2 hours | **Status**: COMPLETED
**Migration**: `031_create_system_chat_groups.sql`

Created 4 system groups with auto-membership triggers:
- Organization group (all users)
- EC Board group (EC members only)
- All Heads group (committee heads)
- All Co-Heads group (committee co-heads)

### Task 1.7: Create Committee Chat Groups ✅
**Effort**: 2 hours | **Status**: COMPLETED
**Migration**: `032_create_committee_chat_groups.sql`

Auto-generates chat groups for all committees with:
- Automatic group creation on new committee
- Auto-add committee members as participants
- Membership sync on role changes

### Task 1.8: Setup Row Level Security Policies ✅
**Effort**: 3 hours | **Status**: COMPLETED
**Migration**: `033_comprehensive_chat_rls_policies.sql`

Comprehensive RLS policies for all chat tables:
- chat_groups, chat_participants, chat_messages
- message_reactions, message_read_status, message_forwards
- typing_indicators
- Helper function: `can_send_message_in_group()`
- Performance indexes added

## Phase 2: Backend API Routes (Week 2)

### Task 2.1: Create Send Message API
**Effort**: 3 hours

Create `/api/chat/messages/send` route:
- Accept text message or file URL
- Validate user is participant in group
- Insert message into database
- Create read_status records for all participants
- Return created message

**Acceptance Criteria**:
- API accepts valid requests
- Messages are persisted correctly
- Read status records created
- Errors handled gracefully

### Task 2.2: Create Edit Message API
**Effort**: 2 hours

Create `/api/chat/messages/[id]/edit` route:
- Validate user is message sender
- Check 5-minute time window
- Update message content
- Set is_edited flag and edited_at timestamp

**Acceptance Criteria**:
- Only sender can edit
- Time window enforced
- Edit flag set correctly

### Task 2.3: Create Delete Message API
**Effort**: 2.5 hours

Create `/api/chat/messages/[id]/delete` route:
- Support "delete for me" and "delete for everyone"
- Validate permissions and time window
- Update is_deleted flag or handle client-side

**Acceptance Criteria**:
- Delete for everyone works within 5 minutes
- Delete for me works anytime
- Proper authorization checks

### Task 2.4: Create Message Reactions API
**Effort**: 2 hours

Create `/api/chat/messages/[id]/react` route:
- Accept emoji character
- Upsert reaction (one per user per message)
- Return updated reaction list

**Acceptance Criteria**:
- Reactions are saved correctly
- Duplicate reactions are updated
- Invalid emojis are rejected

### Task 2.5: Create Forward Message API
**Effort**: 2.5 hours

Create `/api/chat/messages/[id]/forward` route:
- Accept array of target group IDs
- Validate user is participant in all groups
- Create new messages in target groups
- Track forwards in message_forwards table

**Acceptance Criteria**:
- Messages forwarded to all target groups
- User must be participant in all groups
- Forward tracking works

### Task 2.6: Create Pin Message API
**Effort**: 1.5 hours

Create `/api/chat/messages/[id]/pin` route:
- Set is_pinned flag
- Record pinned_by and pinned_at
- Support unpinning

**Acceptance Criteria**:
- Messages can be pinned/unpinned
- Pin metadata recorded correctly

### Task 2.7: Create Mark as Read API
**Effort**: 2 hours

Create `/api/chat/messages/mark-read` route:
- Accept array of message IDs
- Update read_at timestamp for user
- Batch update for performance

**Acceptance Criteria**:
- Multiple messages marked at once
- Read timestamps accurate
- Performance is acceptable

### Task 2.8: Create Typing Indicator API
**Effort**: 2 hours

Create `/api/chat/typing` routes:
- `/start` - Create/update typing indicator
- `/stop` - Delete typing indicator
- Auto-cleanup stale indicators (>5 seconds)

**Acceptance Criteria**:
- Typing indicators created/deleted
- Stale indicators cleaned up
- Performance is good

### Task 2.9: Create File Upload API
**Effort**: 3 hours

Create `/api/chat/upload` route:
- Accept file upload
- Validate file type and size (max 10MB)
- Upload to Supabase Storage
- Return public URL
- Compress images before upload

**Acceptance Criteria**:
- Files uploaded to storage
- File validation works
- URLs are accessible
- Images are compressed

### Task 2.10: Create Personal Chat Creation API
**Effort**: 2 hours

Create `/api/chat/personal/create` route:
- Accept two user IDs
- Check if chat already exists (idempotent)
- Create chat group with chat_type='personal'
- Add both users as participants

**Acceptance Criteria**:
- Personal chats created correctly
- Duplicate chats not created
- Both users are participants

## Phase 3: Real-Time Subscriptions (Week 3)

### Task 3.1: Setup Message Subscription Hook
**Effort**: 3 hours

Create `useMessageSubscription` hook:
- Subscribe to chat_messages INSERT events for group
- Subscribe to chat_messages UPDATE events (edits, deletes)
- Handle new messages in state
- Handle message updates in state

**Acceptance Criteria**:
- New messages appear in real-time
- Edits and deletes sync immediately
- Subscription cleanup on unmount

### Task 3.2: Setup Typing Indicator Subscription
**Effort**: 2 hours

Create `useTypingIndicators` hook:
- Subscribe to typing_indicators table for group
- Track which users are typing
- Remove stale indicators client-side

**Acceptance Criteria**:
- Typing indicators show in real-time
- Indicators disappear after timeout
- Multiple users handled correctly

### Task 3.3: Setup Read Receipt Subscription
**Effort**: 2 hours

Create `useReadReceipts` hook:
- Subscribe to message_read_status updates
- Update message status in real-time
- Track who has read each message

**Acceptance Criteria**:
- Read receipts update instantly
- Status indicators change correctly
- Group read lists accurate

### Task 3.4: Setup Reaction Subscription
**Effort**: 1.5 hours

Create `useReactionSubscription` hook:
- Subscribe to message_reactions INSERT/UPDATE/DELETE
- Update reaction counts in real-time

**Acceptance Criteria**:
- Reactions appear instantly
- Counts update correctly
- Removed reactions disappear

### Task 3.5: Implement Reconnection Logic
**Effort**: 2.5 hours

Add reconnection handling:
- Detect disconnection
- Show "Reconnecting..." indicator
- Fetch missed messages on reconnect
- Resend queued messages

**Acceptance Criteria**:
- Disconnections detected
- Automatic reconnection works
- No messages lost

## Phase 4: Core UI Components (Week 4)

### Task 4.1: Create ChatListPanel Component
**Effort**: 4 hours

Build chat list sidebar:
- Display all user's chat groups
- Show last message preview
- Show unread count badge
- Show typing indicators
- Sort by last message timestamp
- Handle click to select chat

**Acceptance Criteria**:
- All chats displayed correctly
- Unread counts accurate
- Sorting works
- Selection works

### Task 4.2: Create ChatWindow Component
**Effort**: 5 hours

Build main chat interface:
- Display messages in chronological order
- Implement infinite scroll pagination
- Auto-scroll to latest message
- Show pinned messages banner
- Handle loading states

**Acceptance Criteria**:
- Messages display correctly
- Pagination works smoothly
- Auto-scroll functions properly
- Pinned messages visible

### Task 4.3: Create MessageBubble Component
**Effort**: 4 hours

Build individual message display:
- Show sender name and avatar
- Display message content (text/files)
- Show timestamp
- Show status indicators (✓, ✓✓, ✓✓ blue)
- Show "edited" label if edited
- Different styling for own vs others' messages

**Acceptance Criteria**:
- Messages render correctly
- Status indicators accurate
- Styling matches design
- Own messages right-aligned

### Task 4.4: Create MessageInput Component
**Effort**: 4 hours

Build message composition area:
- Text input with auto-resize
- Send button
- File upload button
- Emoji picker button
- Voice note recording button
- Show reply preview when replying
- Show edit mode when editing

**Acceptance Criteria**:
- Text input works smoothly
- All buttons functional
- Reply/edit modes work
- Validation prevents empty sends

### Task 4.5: Create MessageContextMenu Component
**Effort**: 3 hours

Build right-click/long-press menu:
- Reply option
- Edit option (if own message, within 5 min)
- Delete options (for me / for everyone)
- Forward option
- Pin option
- React option

**Acceptance Criteria**:
- Menu appears on interaction
- Options shown based on permissions
- All actions trigger correctly

### Task 4.6: Create ReactionPicker Component
**Effort**: 2.5 hours

Build emoji reaction picker:
- Show common emojis
- Quick reaction bar
- Full emoji picker
- Search functionality

**Acceptance Criteria**:
- Reactions can be added
- Picker UI is intuitive
- Search works

### Task 4.7: Create TypingIndicator Component
**Effort**: 1.5 hours

Build typing indicator display:
- Show "User is typing..." for 1 user
- Show "User1, User2 are typing..." for multiple
- Animate dots

**Acceptance Criteria**:
- Indicator shows correctly
- Multiple users handled
- Animation smooth

## Phase 5: Rich Media Features (Week 5)

### Task 5.1: Implement Image Upload and Preview
**Effort**: 4 hours

Add image handling:
- Image file selection
- Client-side compression
- Upload progress indicator
- Inline thumbnail display
- Lightbox for full-size view

**Acceptance Criteria**:
- Images upload successfully
- Compression reduces file size
- Thumbnails load quickly
- Lightbox works

### Task 5.2: Implement Document Upload and Preview
**Effort**: 3 hours

Add document handling:
- Document file selection
- Upload with progress
- Display file icon, name, size
- Download button

**Acceptance Criteria**:
- Documents upload successfully
- File info displayed correctly
- Downloads work

### Task 5.3: Implement Voice Note Recording
**Effort**: 5 hours

Add voice note functionality:
- Request microphone permission
- Record audio using MediaRecorder API
- Show recording indicator and timer
- Stop recording on release
- Upload audio file
- Generate waveform data

**Acceptance Criteria**:
- Recording works in supported browsers
- Audio quality is acceptable
- Upload succeeds
- Waveform generated

### Task 5.4: Create VoiceNotePlayer Component
**Effort**: 3 hours

Build audio playback:
- Play/pause button
- Waveform visualization
- Seek functionality
- Current time / duration display
- Download option

**Acceptance Criteria**:
- Playback works smoothly
- Waveform displays correctly
- Seeking works
- Download works

### Task 5.5: Implement Emoji Picker Integration
**Effort**: 3 hours

Integrate emoji picker library:
- Install emoji-picker-react or similar
- Add emoji picker to message input
- Add emoji picker to reactions
- Handle emoji insertion

**Acceptance Criteria**:
- Emoji picker opens/closes
- Emojis insert into text
- Reactions work with picker

### Task 5.6: Implement File Preview Lightbox
**Effort**: 2.5 hours

Add image lightbox:
- Full-size image display
- Zoom and pan
- Navigation between images
- Close on click outside

**Acceptance Criteria**:
- Lightbox opens on image click
- Zoom works smoothly
- Navigation works
- Closes correctly

## Phase 6: Advanced Features (Week 6)

### Task 6.1: Implement Message Reply Threading
**Effort**: 3 hours

Add reply functionality:
- Click reply in context menu
- Show reply preview in input
- Send message with reply_to reference
- Display reply preview in message bubble
- Scroll to original on click

**Acceptance Criteria**:
- Reply preview shows correctly
- Reply reference saved
- Scroll to original works

### Task 6.2: Implement Message Forwarding UI
**Effort**: 3 hours

Add forward functionality:
- Show chat selection modal
- Allow multiple chat selection
- Confirm and forward
- Show success message

**Acceptance Criteria**:
- Modal displays all accessible chats
- Multiple selection works
- Forward succeeds
- Confirmation shown

### Task 6.3: Implement Message Pinning UI
**Effort**: 2.5 hours

Add pin functionality:
- Pin/unpin from context menu
- Show pinned messages banner
- Click to scroll to pinned message
- Show pin metadata

**Acceptance Criteria**:
- Messages can be pinned
- Banner displays pinned messages
- Scroll to pinned works
- Metadata shown

### Task 6.4: Implement Message Search
**Effort**: 4 hours

Add search functionality:
- Search input in chat header
- Search messages by content
- Highlight search results
- Navigate between results

**Acceptance Criteria**:
- Search finds messages
- Results highlighted
- Navigation works

### Task 6.5: Implement Chat Muting
**Effort**: 2 hours

Add mute functionality:
- Mute/unmute chat option
- Set mute duration
- Hide notifications when muted
- Show mute indicator

**Acceptance Criteria**:
- Chats can be muted
- Notifications suppressed
- Indicator shows mute status

### Task 6.6: Implement Unread Count Management
**Effort**: 2.5 hours

Add unread tracking:
- Calculate unread count per chat
- Update count on new messages
- Clear count when chat opened
- Show total unread in title

**Acceptance Criteria**:
- Counts accurate
- Updates in real-time
- Clears on open

### Task 6.7: Implement Online Status (Optional)
**Effort**: 3 hours

Add online status:
- Track user online/offline
- Show status indicator
- Show last seen timestamp
- Update in real-time

**Acceptance Criteria**:
- Status tracked accurately
- Indicator shows correctly
- Last seen displayed

## Phase 7: Performance Optimization (Week 7)

### Task 7.1: Implement Message List Virtualization
**Effort**: 4 hours

Add virtual scrolling:
- Install react-window or react-virtuoso
- Virtualize message list
- Maintain scroll position
- Handle dynamic heights

**Acceptance Criteria**:
- Large message lists perform well
- Scrolling is smooth
- Memory usage stable

### Task 7.2: Implement Image Lazy Loading
**Effort**: 2 hours

Add lazy loading:
- Use Intersection Observer
- Load images as they enter viewport
- Show placeholder while loading

**Acceptance Criteria**:
- Images load on demand
- Placeholders shown
- Performance improved

### Task 7.3: Optimize Database Queries
**Effort**: 3 hours

Improve query performance:
- Add missing indexes
- Optimize JOIN queries
- Use SELECT specific columns
- Implement query result caching

**Acceptance Criteria**:
- Queries run faster
- Database load reduced
- Indexes used effectively

### Task 7.4: Implement Debouncing and Throttling
**Effort**: 2 hours

Add rate limiting:
- Debounce typing indicators
- Throttle scroll events
- Batch read receipt updates

**Acceptance Criteria**:
- Unnecessary requests reduced
- Performance improved
- User experience maintained

### Task 7.5: Optimize Real-Time Subscriptions
**Effort**: 2.5 hours

Improve subscription efficiency:
- Use filters to reduce events
- Unsubscribe when not needed
- Batch updates with requestAnimationFrame

**Acceptance Criteria**:
- Fewer unnecessary events
- CPU usage reduced
- UI remains responsive

## Phase 8: Testing and Polish (Week 8)

### Task 8.1: Write Unit Tests for Utility Functions
**Effort**: 4 hours

Test core functions:
- Message validation
- Permission checks
- Status calculation
- Time window validation

**Acceptance Criteria**:
- 90%+ code coverage
- All edge cases tested
- Tests pass consistently

### Task 8.2: Write Integration Tests
**Effort**: 5 hours

Test user flows:
- Send and receive messages
- Edit and delete messages
- React to messages
- Forward messages
- Upload files

**Acceptance Criteria**:
- Critical flows tested
- Tests run reliably
- Failures caught early

### Task 8.3: Implement Error Handling
**Effort**: 3 hours

Add comprehensive error handling:
- Network error recovery
- File upload failures
- Permission errors
- Display user-friendly messages

**Acceptance Criteria**:
- Errors handled gracefully
- Users informed clearly
- Recovery options provided

### Task 8.4: Mobile Responsiveness Testing
**Effort**: 3 hours

Test on mobile devices:
- Test on various screen sizes
- Fix layout issues
- Optimize touch interactions
- Test file uploads on mobile

**Acceptance Criteria**:
- Works on 320px+ screens
- Touch interactions smooth
- All features functional

### Task 8.5: Performance Testing
**Effort**: 3 hours

Test performance:
- Load test with 1000+ messages
- Test with 100+ concurrent users
- Measure real-time latency
- Profile memory usage

**Acceptance Criteria**:
- Meets performance targets
- No memory leaks
- Latency acceptable

### Task 8.6: Security Audit
**Effort**: 3 hours

Review security:
- Test RLS policies
- Verify input validation
- Check for XSS vulnerabilities
- Test rate limiting

**Acceptance Criteria**:
- No security vulnerabilities
- RLS policies effective
- Rate limiting works

### Task 8.7: UI/UX Polish
**Effort**: 4 hours

Final polish:
- Smooth animations
- Consistent styling
- Loading states
- Empty states
- Error states

**Acceptance Criteria**:
- UI feels polished
- Animations smooth
- All states handled

### Task 8.8: Documentation
**Effort**: 3 hours

Write documentation:
- API documentation
- Component documentation
- Setup instructions
- Troubleshooting guide

**Acceptance Criteria**:
- Documentation complete
- Examples provided
- Clear and accurate

## Summary

**Total Tasks**: 68 tasks across 8 phases
**Estimated Effort**: 240-320 hours (6-8 weeks)
**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

**Dependencies**:
- Phase 2 depends on Phase 1 (database schema)
- Phase 3 depends on Phase 2 (API routes)
- Phase 4 depends on Phase 3 (real-time subscriptions)
- Phase 5 can partially overlap with Phase 4
- Phase 6 depends on Phase 4 (core UI)
- Phase 7 can be done after Phase 4
- Phase 8 should be done last

**Risk Mitigation**:
- Test each phase before moving to next
- Build incrementally with working features
- Prioritize core messaging over advanced features
- Monitor performance throughout development
- Regular security reviews

**Success Criteria**:
- All functional requirements met
- Performance targets achieved
- Security requirements satisfied
- User acceptance testing passed
- Documentation complete
