# Visual Workflow Guide - Task Approval System

## 🎯 Complete User Journey

### Step 1: Committee Member Creates Task
```
┌─────────────────────────────────────────────────┐
│ Tasks Page                                       │
├─────────────────────────────────────────────────┤
│                                                  │
│ [+ Assign Task]                                 │
│                                                  │
│ Event: Annual Cultural Fest                     │
│ Assign to: Graphics Committee                   │
│ Task Title: Design Event Poster                 │
│ Description: Create attractive poster...        │
│                                                  │
│ ⚠️ This task will be sent to EC for approval   │
│                                                  │
│ [Assign Task (Pending EC Approval)]            │
└─────────────────────────────────────────────────┘
         ↓
    Task Created
    Status: pending_ec_approval
```

### Step 2: EC Member Sees Notification
```
┌─────────────────────────────────────────────────┐
│ Event Progress Page                              │
├─────────────────────────────────────────────────┤
│                                                  │
│ Active Events                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Annual Cultural Fest                        │ │
│ │ Cultural Committee                          │ │
│ │ [ACTIVE]                                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ← Select Event                                  │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Annual Cultural Fest                        │ │
│ │                                             │ │
│ │ [⚠️ 2 Tasks Awaiting Approval] ← PULSING   │ │
│ │                                             │ │
│ │ Progress Bar: ████████░░░░ 50%             │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
         ↓
    Click Button
```

### Step 3: EC Member Reviews Tasks
```
┌─────────────────────────────────────────────────┐
│ Event Detail Page                                │
├─────────────────────────────────────────────────┤
│                                                  │
│ Annual Cultural Fest                             │
│ Cultural Committee • Jan 15, 2024                │
│                                                  │
│ ⚠️ Tasks Awaiting EC Approval (2)               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ These tasks have been proposed by committee      │
│ members and are waiting for your approval.       │
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ Design Event Poster    [PENDING APPROVAL] │   │
│ │                                           │   │
│ │ Assigned to: Graphics Committee           │   │
│ │ Proposed by: John Doe (Cultural Comm.)    │   │
│ │                                           │   │
│ │ Create an attractive poster for the       │   │
│ │ event with vibrant colors...              │   │
│ │                                           │   │
│ │ [Approve Task]  [Edit & Approve]         │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ Book Venue                [PENDING APPROVAL]│  │
│ │                                           │   │
│ │ Assigned to: Logistics Committee          │   │
│ │ Proposed by: Jane Smith (Cultural Comm.)  │   │
│ │                                           │   │
│ │ Book the auditorium for the event...      │   │
│ │                                           │   │
│ │ [Approve Task]  [Edit & Approve]         │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Step 4A: Approve As-Is
```
┌─────────────────────────────────────────────────┐
│ Click [Approve Task]                             │
│         ↓                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✅ Task approved and assigned!              │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Task Status: approved                            │
│ EC Approved By: Current User                     │
│ EC Approved At: 2024-01-15 10:30 AM             │
│                                                  │
│ Notifications Sent To:                           │
│ • All Graphics Committee Members                 │
└─────────────────────────────────────────────────┘
```

### Step 4B: Edit & Approve
```
┌─────────────────────────────────────────────────┐
│ Click [Edit & Approve]                           │
│         ↓                                        │
│ ┌───────────────────────────────────────────┐   │
│ │ Design Event Poster                       │   │
│ │ [Edit Title Here________________]         │   │
│ │                                           │   │
│ │ [Edit Description Here______________]     │   │
│ │ [_________________________________]       │   │
│ │ [_________________________________]       │   │
│ │                                           │   │
│ │ [Save & Approve]  [Cancel]               │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ Modified Task Saved & Approved                   │
│ Notifications Sent                               │
└─────────────────────────────────────────────────┘
```

### Step 5: Committee Receives Notification
```
┌─────────────────────────────────────────────────┐
│ Notification Bell 🔔 (1)                        │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ 📋 New Task Approved!                     │   │
│ │                                           │   │
│ │ Your committee "Graphics Committee" has   │   │
│ │ been assigned a new task: "Design Event   │   │
│ │ Poster" for the event "Annual Cultural    │   │
│ │ Fest". Check your tasks section to start  │   │
│ │ working on it.                            │   │
│ │                                           │   │
│ │ [View Task →]                             │   │
│ │                                           │   │
│ │ 2 minutes ago                             │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Step 6: Task Appears in Progress
```
┌─────────────────────────────────────────────────┐
│ Event Progress Page                              │
├─────────────────────────────────────────────────┤
│                                                  │
│ Annual Cultural Fest                             │
│                                                  │
│ Progress Bar (Notion Style)                      │
│ ┌───────────────────────────────────────────┐   │
│ │ Graphics Committee                        │   │
│ │ ████████░░░░░░░░░░ 40% (2/5 tasks)       │   │
│ │                                           │   │
│ │ Logistics Committee                       │   │
│ │ ██████░░░░░░░░░░░░ 30% (1/3 tasks)       │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ Event Tasks                                      │
│ 3 of 8 completed                                 │
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ Design Event Poster  [✓ EC APPROVED]     │   │
│ │ Graphics Committee                        │   │
│ │ Approved by Admin on Jan 15, 2024        │   │
│ │                                           │   │
│ │ Progress: ████████░░ 80%                 │   │
│ │ [IN PROGRESS]                            │   │
│ │                                           │   │
│ │ + Add Update                              │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Step 7: Committee Works on Task
```
┌─────────────────────────────────────────────────┐
│ Tasks Page (Committee Member View)               │
├─────────────────────────────────────────────────┤
│                                                  │
│ My Tasks                                         │
│                                                  │
│ ┌───────────────────────────────────────────┐   │
│ │ Design Event Poster                       │   │
│ │ Assigned to: Graphics Committee           │   │
│ │ Event: Annual Cultural Fest               │   │
│ │                                           │   │
│ │ Progress: ████████░░ 80%                 │   │
│ │                                           │   │
│ │ [Update Progress] [Post Update]          │   │
│ │ [Mark Complete]                           │   │
│ │                                           │   │
│ │ Recent Updates:                           │   │
│ │ • First draft completed - 2 hours ago     │   │
│ │ • Colors finalized - 1 day ago            │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 🎨 Color Coding

| Color | Status | Meaning |
|-------|--------|---------|
| 🟨 Yellow | Pending | Awaiting EC approval |
| 🟦 Blue | In Progress | Committee working on it |
| 🟩 Green | Completed | Task finished |
| 🟥 Red | Rejected | Not approved by EC |

## 📊 Status Flow Diagram

```
┌─────────────────┐
│ Task Created    │
│ (Committee)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ pending_ec_     │
│ approval        │ ← Not visible in progress
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌────────┐ ┌────────┐
│Approve │ │Reject  │
└───┬────┘ └───┬────┘
    │          │
    ↓          ↓
┌────────┐ ┌────────┐
│approved│ │rejected│
└───┬────┘ └────────┘
    │
    ↓
┌────────────────┐
│ in_progress    │ ← Visible in progress
└────────┬───────┘
         │
         ↓
┌────────────────┐
│ completed      │ ← Counts toward progress
└────────────────┘
```

## 🔔 Notification Timeline

```
Time    Event                           Who Gets Notified
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10:00   Task Created                    EC Members (optional)
10:05   EC Reviews Task                 -
10:10   EC Approves Task                Assigned Committee Members
10:15   Committee Sees Notification     -
10:20   Committee Starts Work           -
12:00   Committee Updates Progress      -
14:00   Committee Marks Complete        Event Organizers (optional)
```

## 💡 Quick Tips

### For EC Members
- ⚡ Use "Approve Task" for quick approval
- ✏️ Use "Edit & Approve" to modify details
- 👀 Check Event Progress for pending count
- 🔍 Review task details carefully before approving

### For Committee Members
- 📋 Check Tasks page for new assignments
- 🔔 Enable notifications to stay updated
- 📊 Update progress regularly
- 💬 Post updates to keep everyone informed

### For Event Organizers
- 📝 Create clear task descriptions
- 🎯 Assign to appropriate committees
- ⏰ Set realistic deadlines
- 📈 Monitor progress in Event Progress page

## 🎯 Success Metrics

After implementation, you should see:
- ✅ All tasks require EC approval
- ✅ Clear approval status for all stakeholders
- ✅ Automatic notifications working
- ✅ Accurate progress tracking
- ✅ Improved task management workflow
