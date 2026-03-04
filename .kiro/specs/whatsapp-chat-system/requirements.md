# Requirements Document: WhatsApp-like Interactive Chat System

## Overview

This document specifies the functional and non-functional requirements for a WhatsApp-style interactive chat system for the IIChE Student Chapter portal. The system enables real-time messaging with role-based group chats, 1-to-1 conversations, rich media support, and advanced messaging features.

## Functional Requirements

### FR-1: Chat Group Types and Access Control

**FR-1.1: Committee Groups**
- The system SHALL create a separate chat group for each committee
- Only members of a committee SHALL be able to view and participate in that committee's chat
- Committee membership SHALL be verified against the committee_members table
- When a user joins a committee, they SHALL automatically gain access to the committee chat
- When a user leaves a committee, they SHALL lose access to the committee chat

**FR-1.2: Whole Organization Group**
- The system SHALL provide a single organization-wide chat group
- All active users SHALL be able to view and send messages in the organization group
- The organization group SHALL be automatically created during system initialization
- The organization group SHALL NOT be deletable

**FR-1.3: EC Board Group**
- The system SHALL provide a dedicated chat group for Executive Committee members
- Only users with executive_role field set SHALL be able to access the EC Board group
- EC Board group SHALL be visible only to EC members
- The EC Board group SHALL NOT be deletable

**FR-1.4: All Heads Group**
- The system SHALL provide a chat group for all committee heads
- Only users with position='head' in committee_members SHALL be able to access this group
- When a user becomes a head, they SHALL automatically gain access
- When a user is no longer a head, they SHALL lose access

**FR-1.5: All Co-Heads Group**
- The system SHALL provide a chat group for all committee co-heads
- Only users with position='co_head' in committee_members SHALL be able to access this group
- Access SHALL be automatically managed based on committee_members table

**FR-1.6: Personal 1-to-1 Chat**
- Any user SHALL be able to initiate a 1-to-1 chat with any other user
- Personal chats SHALL have exactly 2 participants
- Only one personal chat SHALL exist between any two users (idempotent creation)
- Both participants SHALL have equal permissions in personal chats

### FR-2: Core Messaging Features

**FR-2.1: Text Messages**
- Users SHALL be able to send text messages up to 10,000 characters
- Messages SHALL support Unicode characters including emojis
- URLs in messages SHALL be automatically detected and linkified
- Messages SHALL display sender name, timestamp, and content

**FR-2.2: File Uploads**
- Users SHALL be able to upload images (JPEG, PNG, GIF, WebP)
- Users SHALL be able to upload documents (PDF, DOC, DOCX, XLS, XLSX)
- Users SHALL be able to upload other files with approved extensions
- Maximum file size SHALL be 10MB per file
- Files SHALL be stored in Supabase Storage with access control
- File uploads SHALL show progress indicator

**FR-2.3: Voice Notes**
- Users SHALL be able to record audio messages directly in the browser
- Voice notes SHALL be recorded in WebM or MP3 format
- Maximum voice note duration SHALL be 5 minutes
- Voice notes SHALL display waveform visualization
- Voice notes SHALL have play/pause controls and seek functionality

**FR-2.4: Image Preview**
- Images SHALL display inline in the chat with thumbnails
- Clicking an image SHALL open full-size preview in lightbox
- Image preview SHALL support zoom and pan
- Images SHALL be lazy-loaded for performance

**FR-2.5: Document Preview**
- PDF files SHALL show icon, filename, and file size
- Documents SHALL have download button
- Document previews SHALL show first page thumbnail (optional)

### FR-3: Interactive Messaging Features

**FR-3.1: Message Reactions**
- Users SHALL be able to react to any message with emoji
- Each user SHALL be able to add one reaction per message
- Users SHALL be able to change their reaction
- Reactions SHALL be grouped by emoji with counts
- Clicking a reaction SHALL show list of users who reacted

**FR-3.2: Message Editing**
- Users SHALL be able to edit their own text messages
- Editing SHALL be allowed only within 5 minutes of sending
- Edited messages SHALL display "edited" label
- Edit history SHALL NOT be preserved (single version)
- File-only messages SHALL NOT be editable

**FR-3.3: Message Deletion**
- Users SHALL be able to delete messages "for me" (hide locally)
- Senders SHALL be able to delete messages "for everyone" within 5 minutes
- Deleted messages SHALL show "This message was deleted" placeholder
- Deleted messages SHALL remove file attachments
- Reactions and replies SHALL be preserved but hidden

**FR-3.4: Reply to Messages**
- Users SHALL be able to reply to any message
- Reply SHALL show preview of original message
- Clicking reply preview SHALL scroll to original message
- Replies SHALL work across message history (not just recent)

**FR-3.5: Message Forwarding**
- Users SHALL be able to forward messages to other chats
- Users SHALL be able to select multiple destination chats
- Forwarded messages SHALL create new messages in destination chats
- Forward tracking SHALL link original to forwarded messages
- Users must be participants in both source and destination chats

**FR-3.6: Message Pinning**
- Users with appropriate permissions SHALL be able to pin messages
- Pinned messages SHALL appear in a banner at top of chat
- Multiple messages can be pinned per chat
- Clicking pinned message SHALL scroll to original location
- Pinned messages SHALL show who pinned and when

### FR-4: Message Status and Read Receipts

**FR-4.1: Message Status Indicators**
- Sent messages SHALL show single gray checkmark (✓)
- Delivered messages SHALL show double gray checkmarks (✓✓)
- Read messages SHALL show double blue checkmarks (✓✓)
- Status SHALL update in real-time

**FR-4.2: Delivery Tracking**
- Messages SHALL be marked as delivered when received by client
- Delivery status SHALL be tracked per recipient
- Group messages SHALL show delivered when all recipients receive

**FR-4.3: Read Tracking**
- Messages SHALL be marked as read when viewed by recipient
- Read status SHALL be tracked per recipient
- Users SHALL NOT be able to mark their own messages as read

**FR-4.4: Read Receipts in Groups**
- Group messages SHALL show aggregate read status
- Hovering/clicking status SHALL show list of who read the message
- Read receipts SHALL show user names and read timestamps

### FR-5: Real-Time Features

**FR-5.1: Typing Indicators**
- System SHALL show "typing..." when user is actively typing
- Typing indicator SHALL appear after first keystroke
- Typing indicator SHALL disappear after 3 seconds of inactivity
- Typing indicator SHALL disappear immediately when message is sent
- Multiple users typing SHALL show "User1, User2 are typing..."

**FR-5.2: Real-Time Message Delivery**
- New messages SHALL appear instantly for online recipients
- Message updates (edits, deletions) SHALL sync in real-time
- Reactions SHALL update in real-time
- Read receipts SHALL update in real-time

**FR-5.3: Online Status**
- System SHALL track user online/offline status (optional)
- Last seen timestamp SHALL be displayed (optional)
- Online status SHALL update in real-time

### FR-6: Chat List and Navigation

**FR-6.1: Chat List Display**
- System SHALL display list of all accessible chats
- Each chat SHALL show last message preview
- Each chat SHALL show timestamp of last message
- Each chat SHALL show unread count badge
- Chats SHALL be sorted by last message timestamp (most recent first)

**FR-6.2: Unread Count**
- System SHALL track unread message count per chat
- Unread count SHALL display as badge on chat item
- Unread count SHALL update in real-time
- Opening a chat SHALL mark messages as read and clear count

**FR-6.3: Search and Filter**
- Users SHALL be able to search chats by name
- Users SHALL be able to filter chats by type (personal, groups)
- Search SHALL be case-insensitive and support partial matches

### FR-7: Message History and Pagination

**FR-7.1: Infinite Scroll**
- Chat SHALL load initial 50 messages
- Scrolling to top SHALL load older messages (50 at a time)
- Loading older messages SHALL preserve scroll position
- System SHALL indicate when no more messages are available

**FR-7.2: Auto-Scroll**
- New messages SHALL trigger auto-scroll to bottom
- Auto-scroll SHALL only occur if user is near bottom
- Manual scroll up SHALL disable auto-scroll
- Scroll-to-bottom button SHALL appear when scrolled up

**FR-7.3: Message Timestamps**
- Messages SHALL show time (HH:MM format)
- Date separators SHALL appear for different days
- Relative timestamps SHALL be used ("Today", "Yesterday")

### FR-8: Notifications

**FR-8.1: In-App Notifications**
- New messages SHALL show popup notification when window not focused
- Notification SHALL show sender name and message preview
- Clicking notification SHALL open the chat
- Notifications SHALL respect browser permissions

**FR-8.2: Unread Badges**
- Total unread count SHALL display in page title
- Each chat SHALL show unread count badge
- Unread badges SHALL update in real-time

### FR-9: Emoji and Stickers

**FR-9.1: Emoji Picker**
- System SHALL provide emoji picker interface
- Emoji picker SHALL support search
- Emoji picker SHALL show recently used emojis
- Emoji picker SHALL categorize emojis

**FR-9.2: Emoji in Messages**
- Messages SHALL support Unicode emoji characters
- Emoji SHALL render with consistent appearance
- Large single-emoji messages SHALL display larger

## Non-Functional Requirements

### NFR-1: Performance

**NFR-1.1: Response Time**
- Message send SHALL complete within 500ms under normal conditions
- Real-time message delivery SHALL have latency < 500ms
- Chat list SHALL load within 2 seconds
- Initial message load SHALL complete within 2 seconds

**NFR-1.2: Scalability**
- System SHALL support 100+ concurrent users per group
- System SHALL handle 1000+ messages per group efficiently
- System SHALL support 50+ simultaneous chat groups

**NFR-1.3: Resource Usage**
- Message list SHALL use virtualization for 500+ messages
- Images SHALL be lazy-loaded
- File downloads SHALL not block UI
- Memory usage SHALL remain stable during long sessions

### NFR-2: Security

**NFR-2.1: Authentication**
- All API routes SHALL require authenticated session
- Unauthenticated requests SHALL return 401 Unauthorized

**NFR-2.2: Authorization**
- Users SHALL only access chats they are participants of
- Row Level Security policies SHALL enforce access control
- API routes SHALL verify user permissions before operations

**NFR-2.3: Input Validation**
- All user inputs SHALL be validated and sanitized
- File uploads SHALL be validated for type and size
- Malicious file extensions SHALL be rejected
- XSS attacks SHALL be prevented through content escaping

**NFR-2.4: Rate Limiting**
- Message sending SHALL be rate-limited to 10 messages per minute
- File uploads SHALL be rate-limited to 5 files per minute
- API requests SHALL be throttled to prevent abuse

### NFR-3: Reliability

**NFR-3.1: Data Persistence**
- Messages SHALL be persisted to database before acknowledgment
- File uploads SHALL be atomic (complete or fail)
- Database transactions SHALL ensure data consistency

**NFR-3.2: Error Handling**
- Network errors SHALL be handled gracefully with retry logic
- Failed messages SHALL be queued for retry
- Users SHALL be notified of persistent errors

**NFR-3.3: Real-Time Reconnection**
- WebSocket disconnections SHALL trigger automatic reconnection
- Missed messages SHALL be fetched on reconnection
- Queued messages SHALL be sent after reconnection

### NFR-4: Usability

**NFR-4.1: Responsive Design**
- UI SHALL be fully responsive for mobile, tablet, and desktop
- Touch interactions SHALL be optimized for mobile
- Layout SHALL adapt to different screen sizes

**NFR-4.2: Accessibility**
- UI SHALL follow WCAG 2.1 Level AA guidelines where possible
- Keyboard navigation SHALL be supported
- Screen reader compatibility SHALL be considered

**NFR-4.3: User Experience**
- UI SHALL mirror familiar WhatsApp interaction patterns
- Loading states SHALL provide visual feedback
- Error messages SHALL be clear and actionable

### NFR-5: Maintainability

**NFR-5.1: Code Quality**
- Code SHALL follow TypeScript best practices
- Components SHALL be modular and reusable
- Functions SHALL have clear single responsibilities

**NFR-5.2: Documentation**
- All functions SHALL have JSDoc comments
- Complex algorithms SHALL be documented
- API routes SHALL be documented

**NFR-5.3: Testing**
- Unit tests SHALL cover utility functions (90%+ coverage)
- Integration tests SHALL cover critical user flows
- Property-based tests SHALL validate correctness properties

## Constraints

### Technical Constraints

**TC-1: Technology Stack**
- Frontend: Next.js 14+ with TypeScript
- Backend: Next.js API Routes
- Database: PostgreSQL via Supabase
- Real-time: Supabase Realtime
- Storage: Supabase Storage
- Styling: Tailwind CSS

**TC-2: Browser Support**
- Modern browsers (Chrome, Firefox, Safari, Edge)
- WebSocket support required
- MediaRecorder API for voice notes
- IndexedDB for offline support (optional)

**TC-3: File Storage**
- Maximum file size: 10MB
- Supported formats: Images (JPEG, PNG, GIF, WebP), Documents (PDF, DOC, DOCX), Audio (WebM, MP3)
- Storage quota managed by Supabase

### Business Constraints

**BC-1: User Roles**
- System SHALL integrate with existing role system
- Roles: Committee Member, Co-Head, Head, EC Member, Faculty, Admin
- Role changes SHALL immediately affect chat access

**BC-2: Data Retention**
- Messages SHALL be retained indefinitely (no automatic deletion)
- Deleted messages SHALL be marked as deleted, not removed
- File storage SHALL respect Supabase quotas

**BC-3: Privacy**
- Messages SHALL only be visible to group participants
- Personal chats SHALL be private between two users
- No message content SHALL be logged or exposed

## Acceptance Criteria

### AC-1: Core Messaging
- [ ] Users can send and receive text messages in real-time
- [ ] Users can upload and view images inline
- [ ] Users can upload and download documents
- [ ] Users can record and play voice notes
- [ ] Message status indicators work correctly (sent, delivered, read)

### AC-2: Interactive Features
- [ ] Users can react to messages with emoji
- [ ] Users can edit messages within 5-minute window
- [ ] Users can delete messages for themselves or everyone
- [ ] Users can reply to messages with preview
- [ ] Users can forward messages to other chats
- [ ] Users can pin important messages

### AC-3: Group Access Control
- [ ] Committee members can access only their committee chat
- [ ] EC members can access EC Board group
- [ ] Heads can access All Heads group
- [ ] Co-heads can access All Co-Heads group
- [ ] All users can access Organization group
- [ ] Users can create 1-to-1 chats with anyone

### AC-4: Real-Time Synchronization
- [ ] New messages appear instantly for online users
- [ ] Typing indicators show when users are typing
- [ ] Read receipts update in real-time
- [ ] Message edits and deletions sync immediately

### AC-5: Performance
- [ ] Chat list loads within 2 seconds
- [ ] Messages load within 2 seconds
- [ ] Real-time latency is under 500ms
- [ ] Infinite scroll works smoothly with 1000+ messages

### AC-6: Mobile Responsiveness
- [ ] UI works on mobile devices (320px+ width)
- [ ] Touch interactions work correctly
- [ ] File uploads work on mobile
- [ ] Voice recording works on mobile browsers

## Dependencies

- Supabase project with PostgreSQL database
- Supabase Realtime enabled
- Supabase Storage bucket configured
- Existing user authentication system
- Existing role and committee management system

## Risks and Mitigations

### Risk 1: Real-Time Performance at Scale
**Impact**: High message volume could cause lag
**Mitigation**: Implement pagination, virtualization, and efficient queries

### Risk 2: File Storage Costs
**Impact**: Large file uploads could exceed storage quotas
**Mitigation**: Enforce file size limits, compress images, monitor usage

### Risk 3: Browser Compatibility
**Impact**: Voice recording may not work on all browsers
**Mitigation**: Detect browser capabilities, provide fallback options

### Risk 4: Network Reliability
**Impact**: Poor connections could cause message delivery failures
**Mitigation**: Implement retry logic, queue messages, show clear status

## Success Metrics

- 90%+ of messages delivered within 500ms
- 95%+ user satisfaction with chat experience
- Zero unauthorized access incidents
- 99%+ uptime for real-time messaging
- Average response time < 2 seconds for all operations
