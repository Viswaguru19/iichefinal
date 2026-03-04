# Role-Based System Overhaul - Design Document

## Overview

This design document specifies the technical architecture and implementation approach for a comprehensive role-based management system for the IIChE Student Chapter portal. The system enforces strict hierarchical permissions, approval workflows, and role-specific dashboards across 11 major feature areas.

### Design Principles

1. **Role-Based Access Control (RBAC)**: All features enforce role hierarchy
2. **Separation of Concerns**: Modular architecture with clear boundaries
3. **Real-Time First**: Use Supabase Realtime for live updates
4. **Security by Default**: RLS policies prevent unauthorized access
5. **Audit Everything**: All approvals and admin actions logged
6. **Mobile-First**: Responsive design for all screen sizes
7. **Performance**: Optimize for 500+ concurrent users

### Technology Stack

**Frontend**:
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS + Framer Motion
- React Hook Form + Zod
- Supabase Client

**Backend**:
- Supabase (PostgreSQL)
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions

**External APIs**:
- Microsoft Graph API (Teams integration)

**Development Tools**:
- ESLint + Prettier
- Vitest (unit tests)
- Playwright (E2E tests)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │  Tasks   │  │   Chat   │  │ Meetings │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Backend                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │   Auth   │  │ Storage  │  │ Realtime │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│              Microsoft Graph API (Teams)                     │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

```
app/
├── (dashboard)/
│   ├── layout.tsx              # Role-based navigation
│   ├── page.tsx                # Dynamic dashboard by role
│   ├── tasks/
│   │   ├── page.tsx            # Task list
│   │   ├── create/page.tsx     # Task creation
│   │   └── [id]/page.tsx       # Task detail
│   ├── chat/
│   │   ├── page.tsx            # Chat list
│   │   └── [id]/page.tsx       # Chat conversation
│   ├── meetings/
│   │   ├── page.tsx            # Meeting list
│   │   └── create/page.tsx     # Meeting creation
│   ├── documents/page.tsx      # Central documents
│   ├── faculty/page.tsx        # Faculty dashboard
│   └── admin/
│       ├── page.tsx            # Admin dashboard
│       ├── users/page.tsx      # User management
│       └── settings/page.tsx   # System settings
├── api/
│   ├── tasks/
│   │   ├── create/route.ts
│   │   ├── approve/route.ts
│   │   └── update/route.ts
│   ├── chat/
│   │   ├── send/route.ts
│   │   └── typing/route.ts
│   ├── meetings/
│   │   ├── create/route.ts
│   │   └── teams/route.ts
│   └── approvals/
│       ├── events/route.ts
│       ├── tasks/route.ts
│       ├── emails/route.ts
│       └── posters/route.ts
└── kickoff/
    ├── page.tsx                # Kickoff info
    └── register/page.tsx       # Registration form

components/
├── dashboard/
│   ├── RoleDashboard.tsx       # Dynamic dashboard
│   ├── TaskCard.tsx
│   ├── ApprovalCard.tsx
│   └── ProgressWidget.tsx
├── tasks/
│   ├── TaskList.tsx
│   ├── TaskForm.tsx
│   ├── TaskApproval.tsx
│   └── TaskStatusBadge.tsx
├── chat/
│   ├── ChatList.tsx
│   ├── ChatConversation.tsx
│   ├── MessageBubble.tsx
│   ├── TypingIndicator.tsx
│   └── FileUpload.tsx
├── meetings/
│   ├── MeetingForm.tsx
│   ├── MeetingCard.tsx
│   └── CalendarView.tsx
└── shared/
    ├── RoleGuard.tsx           # Permission wrapper
    ├── ApprovalButton.tsx
    └── DocumentViewer.tsx

lib/
├── permissions.ts              # Role permission checks
├── task-utils.ts               # Task operations
├── chat-utils.ts               # Chat operations
├── meeting-utils.ts            # Meeting operations
├── approval-workflow.ts        # Approval logic
└── supabase/
    ├── client.ts
    ├── server.ts
    └── realtime.ts
```


## Data Models

### Core Tables

#### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT,
  roll_number TEXT,
  year INTEGER,
  branch TEXT,
  executive_role TEXT, -- secretary, joint_secretary, etc.
  is_faculty BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### committee_members
```sql
CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  position TEXT NOT NULL, -- member, co_head, head
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, committee_id)
);
```

#### tasks (Enhanced)
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_committee_id UUID REFERENCES committees(id),
  created_by UUID REFERENCES profiles(id),
  deadline TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium', -- low, medium, high
  status TEXT DEFAULT 'pending_ec_approval',
  -- pending_ec_approval, ec_rejected, not_started, 
  -- in_progress, partially_completed, completed
  ec_approved_by UUID REFERENCES profiles(id),
  ec_approved_at TIMESTAMPTZ,
  ec_rejection_reason TEXT,
  ec_modified_fields JSONB, -- Track what EC changed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### task_updates
```sql
CREATE TABLE task_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  update_text TEXT NOT NULL,
  documents TEXT[], -- Array of document URLs
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### documents
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  task_id UUID REFERENCES tasks(id),
  event_id UUID REFERENCES events(id),
  committee_id UUID REFERENCES committees(id),
  category TEXT, -- task_document, poster, email_attachment, etc.
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_year ON documents(EXTRACT(YEAR FROM uploaded_at));
CREATE INDEX idx_documents_month ON documents(EXTRACT(MONTH FROM uploaded_at));
CREATE INDEX idx_documents_event ON documents(event_id);
CREATE INDEX idx_documents_committee ON documents(committee_id);
CREATE INDEX idx_documents_task ON documents(task_id);
CREATE INDEX idx_documents_uploader ON documents(uploaded_by);
```

#### chat_groups
```sql
CREATE TABLE chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  -- personal, committee, organization, executive, coheads, custom
  committee_id UUID REFERENCES committees(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### chat_members
```sql
CREATE TABLE chat_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(group_id, user_id)
);
```

#### chat_messages
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  message_text TEXT,
  reply_to_id UUID REFERENCES chat_messages(id),
  attachments TEXT[], -- Array of file URLs
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_messages_group ON chat_messages(group_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
```

#### chat_message_reads
```sql
CREATE TABLE chat_message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);
```

#### pr_emails
```sql
CREATE TABLE pr_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipients TEXT[], -- Array of email addresses
  created_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'draft',
  -- draft, pending_faculty_approval, approved, rejected, sent
  faculty_approved_by UUID REFERENCES profiles(id),
  faculty_approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### posters
```sql
CREATE TABLE posters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  poster_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending_faculty_approval',
  -- pending_faculty_approval, approved, rejected
  faculty_approved_by UUID REFERENCES profiles(id),
  faculty_approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### kickoff_registrations
```sql
CREATE TABLE kickoff_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  year INTEGER,
  branch TEXT,
  status TEXT DEFAULT 'pending_approval',
  -- pending_approval, approved, rejected
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);
```

#### kickoff_schedules
```sql
CREATE TABLE kickoff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  schedule_data JSONB NOT NULL,
  -- {date, time, venue, agenda, sessions: [...]}
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending_approval',
  -- pending_approval, approved
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### meetings
```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL, -- offline, online
  location TEXT, -- For offline meetings
  teams_link TEXT, -- For online meetings
  meeting_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### meeting_participants
```sql
CREATE TABLE meeting_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rsvp_status TEXT DEFAULT 'pending',
  -- pending, accepted, declined
  rsvp_at TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id)
);
```

#### approval_logs
```sql
CREATE TABLE approval_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_role TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  -- event, task, email, poster, finance, kickoff_registration
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  -- approve, reject, modify
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  changes JSONB, -- For modify actions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_logs_entity ON approval_logs(entity_type, entity_id);
CREATE INDEX idx_approval_logs_user ON approval_logs(user_id);
CREATE INDEX idx_approval_logs_date ON approval_logs(created_at DESC);
```

#### admin_actions
```sql
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  -- change_password, change_email, change_role, deactivate_user, etc.
  target_user_id UUID REFERENCES profiles(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```


## Part 1: Event Proposal Workflow (Enhancement)

### Current Implementation
Event workflow already exists: Co-head → Head → EC (2/6) → Faculty

### Enhancement Required
After faculty approval, automatically:
1. Set event status to `active`
2. Enable task creation for proposing committee
3. Show event in public events list
4. Initialize progress tracking

### Implementation

**File**: `lib/approval-workflow.ts`

```typescript
export async function approveEventAsFaculty(
  eventId: string,
  facultyId: string
) {
  const supabase = createClient();
  
  // Update event status
  const { error } = await supabase
    .from('events')
    .update({
      status: 'active',
      faculty_approved_by: facultyId,
      faculty_approved_at: new Date().toISOString()
    })
    .eq('id', eventId);
  
  if (error) throw error;
  
  // Log approval
  await logApproval({
    user_id: facultyId,
    user_role: 'faculty',
    entity_type: 'event',
    entity_id: eventId,
    action: 'approve',
    previous_status: 'pending_faculty_approval',
    new_status: 'active'
  });
  
  return { success: true };
}
```

**UI Changes**: None required, already implemented in proposals page.

## Part 2: Task Assignment System

### 2.1 Task Creation Interface

**File**: `app/dashboard/tasks/create/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/lib/task-utils';
import TaskForm from '@/components/tasks/TaskForm';

export default function CreateTaskPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(data: TaskFormData) {
    setLoading(true);
    try {
      await createTask(data);
      toast.success('Task created and sent for EC approval');
      router.push('/dashboard/tasks');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create Task</h1>
      <TaskForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
```

**Component**: `components/tasks/TaskForm.tsx`

```typescript
interface TaskFormData {
  event_id: string;
  title: string;
  description?: string;
  assigned_to_committee_id: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  documents?: File[];
}

export default function TaskForm({ onSubmit, loading }: Props) {
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema)
  });
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Select name="event_id" label="Event" required />
      <Input name="title" label="Task Title" required />
      <Textarea name="description" label="Description" />
      <Select name="assigned_to_committee_id" label="Assign To" required />
      <DatePicker name="deadline" label="Deadline" />
      <Select name="priority" label="Priority" />
      <FileUpload name="documents" label="Attach Documents" multiple />
      <Button type="submit" loading={loading}>Create Task</Button>
    </form>
  );
}
```

**Utility**: `lib/task-utils.ts`

```typescript
export async function createTask(data: TaskFormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Upload documents first
  const documentUrls = await uploadDocuments(data.documents);
  
  // Create task
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      event_id: data.event_id,
      title: data.title,
      description: data.description,
      assigned_to_committee_id: data.assigned_to_committee_id,
      deadline: data.deadline,
      priority: data.priority,
      created_by: user.id,
      status: 'pending_ec_approval'
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Store documents
  if (documentUrls.length > 0) {
    await supabase.from('documents').insert(
      documentUrls.map(url => ({
        filename: url.split('/').pop(),
        file_url: url,
        uploaded_by: user.id,
        task_id: task.id,
        event_id: data.event_id,
        category: 'task_document'
      }))
    );
  }
  
  return task;
}
```

### 2.2 EC Task Approval Interface

**File**: `app/dashboard/tasks/approve/page.tsx`

```typescript
'use client';

export default function TaskApprovalPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  useEffect(() => {
    loadPendingTasks();
  }, []);
  
  async function loadPendingTasks() {
    const { data } = await supabase
      .from('tasks')
      .select(`
        *,
        event:events(title),
        assigned_committee:committees(name),
        creator:profiles(name)
      `)
      .eq('status', 'pending_ec_approval')
      .order('created_at', { ascending: false });
    
    setTasks(data || []);
  }
  
  async function handleApprove(taskId: string) {
    await approveTask(taskId);
    toast.success('Task approved and assigned to committee');
    loadPendingTasks();
  }
  
  async function handleModifyAndApprove(taskId: string, changes: Partial<Task>) {
    await modifyAndApproveTask(taskId, changes);
    toast.success('Task modified and approved');
    loadPendingTasks();
  }
  
  async function handleReject(taskId: string, reason: string) {
    await rejectTask(taskId, reason);
    toast.success('Task rejected');
    loadPendingTasks();
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Task Approvals</h1>
      
      <div className="grid gap-4">
        {tasks.map(task => (
          <TaskApprovalCard
            key={task.id}
            task={task}
            onApprove={() => handleApprove(task.id)}
            onModify={() => {
              setSelectedTask(task);
              setShowEditModal(true);
            }}
            onReject={(reason) => handleReject(task.id, reason)}
          />
        ))}
      </div>
      
      {showEditModal && (
        <TaskEditModal
          task={selectedTask}
          onSave={(changes) => handleModifyAndApprove(selectedTask.id, changes)}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
```

**Utility Functions**:

```typescript
export async function approveTask(taskId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'not_started',
      ec_approved_by: user.id,
      ec_approved_at: new Date().toISOString()
    })
    .eq('id', taskId);
  
  if (error) throw error;
  
  await logApproval({
    user_id: user.id,
    user_role: 'ec',
    entity_type: 'task',
    entity_id: taskId,
    action: 'approve',
    previous_status: 'pending_ec_approval',
    new_status: 'not_started'
  });
}

export async function modifyAndApproveTask(
  taskId: string,
  changes: Partial<Task>
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('tasks')
    .update({
      ...changes,
      status: 'not_started',
      ec_approved_by: user.id,
      ec_approved_at: new Date().toISOString(),
      ec_modified_fields: changes
    })
    .eq('id', taskId);
  
  if (error) throw error;
  
  await logApproval({
    user_id: user.id,
    user_role: 'ec',
    entity_type: 'task',
    entity_id: taskId,
    action: 'modify',
    previous_status: 'pending_ec_approval',
    new_status: 'not_started',
    changes
  });
}

export async function rejectTask(taskId: string, reason: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'ec_rejected',
      ec_rejection_reason: reason
    })
    .eq('id', taskId);
  
  if (error) throw error;
  
  await logApproval({
    user_id: user.id,
    user_role: 'ec',
    entity_type: 'task',
    entity_id: taskId,
    action: 'reject',
    previous_status: 'pending_ec_approval',
    new_status: 'ec_rejected',
    reason
  });
}
```

### 2.3 Task Execution Interface

**File**: `app/dashboard/tasks/[id]/page.tsx`

```typescript
'use client';

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<Task | null>(null);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  
  useEffect(() => {
    loadTask();
    loadUpdates();
  }, [params.id]);
  
  async function updateStatus(newStatus: TaskStatus) {
    await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', params.id);
    
    toast.success('Status updated');
    loadTask();
  }
  
  async function postUpdate() {
    const documentUrls = await uploadDocuments(files);
    
    await supabase.from('task_updates').insert({
      task_id: params.id,
      user_id: user.id,
      update_text: newUpdate,
      documents: documentUrls
    });
    
    setNewUpdate('');
    setFiles([]);
    loadUpdates();
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <TaskHeader task={task} onStatusChange={updateStatus} />
      <TaskDetails task={task} />
      <TaskUpdates updates={updates} />
      <TaskUpdateForm
        value={newUpdate}
        onChange={setNewUpdate}
        files={files}
        onFilesChange={setFiles}
        onSubmit={postUpdate}
      />
    </div>
  );
}
```

### 2.4 Central Documents Repository

**File**: `app/dashboard/documents/page.tsx`

```typescript
'use client';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filters, setFilters] = useState({
    year: null,
    month: null,
    event_id: null,
    committee_id: null,
    task_id: null,
    uploaded_by: null
  });
  
  useEffect(() => {
    loadDocuments();
  }, [filters]);
  
  async function loadDocuments() {
    let query = supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles(name),
        event:events(title),
        committee:committees(name),
        task:tasks(title)
      `)
      .order('uploaded_at', { ascending: false });
    
    if (filters.year) {
      query = query.eq(
        supabase.raw('EXTRACT(YEAR FROM uploaded_at)'),
        filters.year
      );
    }
    if (filters.month) {
      query = query.eq(
        supabase.raw('EXTRACT(MONTH FROM uploaded_at)'),
        filters.month
      );
    }
    if (filters.event_id) query = query.eq('event_id', filters.event_id);
    if (filters.committee_id) query = query.eq('committee_id', filters.committee_id);
    if (filters.task_id) query = query.eq('task_id', filters.task_id);
    if (filters.uploaded_by) query = query.eq('uploaded_by', filters.uploaded_by);
    
    const { data } = await query;
    setDocuments(data || []);
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Documents</h1>
      
      <DocumentFilters filters={filters} onChange={setFilters} />
      
      <DocumentGrid documents={documents} />
    </div>
  );
}
```


## Part 3: Faculty Dashboard

### Dashboard Layout

**File**: `app/dashboard/faculty/page.tsx`

```typescript
'use client';

export default function FacultyDashboard() {
  const [stats, setStats] = useState({});
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [taskProgress, setTaskProgress] = useState([]);
  
  useEffect(() => {
    loadDashboardData();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('faculty_dashboard')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, loadDashboardData)
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <FacultyHeader />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Section 1: Finance Overview */}
        <FinanceOverviewWidget stats={stats.finance} />
        
        {/* Section 2: Upcoming Events */}
        <UpcomingEventsWidget events={upcomingEvents} />
        
        {/* Section 3: Proposal Approvals (Prominent) */}
        <PendingApprovalsSection
          events={pendingApprovals.events}
          emails={pendingApprovals.emails}
          posters={pendingApprovals.posters}
          onApprove={handleApprove}
          onReject={handleReject}
        />
        
        {/* Section 4: Task Progress */}
        <TaskProgressWidget progress={taskProgress} />
        
        {/* Section 5: Kick-Off Status */}
        <KickOffStatusWidget kickoff={stats.kickoff} />
        
        {/* Section 6: Meeting Schedules */}
        <MeetingSchedulesWidget meetings={stats.meetings} />
        
        {/* Section 7: Email/Poster Approvals */}
        <QuickApprovalsWidget
          emails={pendingApprovals.emails}
          posters={pendingApprovals.posters}
        />
        
        {/* Section 8: Documents Access */}
        <DocumentsAccessWidget />
      </div>
    </div>
  );
}
```

**Components**:

```typescript
// components/faculty/FinanceOverviewWidget.tsx
export function FinanceOverviewWidget({ stats }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Finance Overview</h2>
      <div className="grid grid-cols-3 gap-6">
        <StatCard
          label="Total Income"
          value={`₹${stats.totalIncome.toLocaleString()}`}
          color="green"
        />
        <StatCard
          label="Total Expense"
          value={`₹${stats.totalExpense.toLocaleString()}`}
          color="red"
        />
        <StatCard
          label="Balance"
          value={`₹${stats.balance.toLocaleString()}`}
          color="blue"
        />
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-600">
          Pending Approvals: {stats.pendingCount}
        </p>
      </div>
    </div>
  );
}

// components/faculty/PendingApprovalsSection.tsx
export function PendingApprovalsSection({ events, onApprove, onReject }: Props) {
  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl shadow-lg p-6 border-2 border-orange-200">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="w-8 h-8 text-orange-600" />
        <h2 className="text-2xl font-bold text-gray-900">
          Pending Approvals ({events.length})
        </h2>
      </div>
      
      <div className="space-y-4">
        {events.map(event => (
          <EventApprovalCard
            key={event.id}
            event={event}
            onApprove={() => onApprove('event', event.id)}
            onReject={(reason) => onReject('event', event.id, reason)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Part 4: PR & Graphics Control

### 4.1 PR Email Workflow

**File**: `app/dashboard/pr/emails/page.tsx`

```typescript
'use client';

export default function PREmailsPage() {
  const [emails, setEmails] = useState<PREmail[]>([]);
  const [showDraftModal, setShowDraftModal] = useState(false);
  
  async function createDraft(data: EmailDraftData) {
    await supabase.from('pr_emails').insert({
      event_id: data.event_id,
      subject: data.subject,
      body: data.body,
      recipients: data.recipients,
      created_by: user.id,
      status: 'draft'
    });
    
    toast.success('Draft saved');
    loadEmails();
  }
  
  async function submitForApproval(emailId: string) {
    await supabase
      .from('pr_emails')
      .update({ status: 'pending_faculty_approval' })
      .eq('id', emailId);
    
    toast.success('Submitted for faculty approval');
    loadEmails();
  }
  
  async function sendEmail(emailId: string) {
    // Call edge function to send email
    await fetch('/api/pr/send-email', {
      method: 'POST',
      body: JSON.stringify({ emailId })
    });
    
    await supabase
      .from('pr_emails')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', emailId);
    
    toast.success('Email sent successfully');
    loadEmails();
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">PR Emails</h1>
        <Button onClick={() => setShowDraftModal(true)}>
          New Email Draft
        </Button>
      </div>
      
      <EmailList
        emails={emails}
        onSubmit={submitForApproval}
        onSend={sendEmail}
      />
      
      {showDraftModal && (
        <EmailDraftModal
          onSave={createDraft}
          onClose={() => setShowDraftModal(false)}
        />
      )}
    </div>
  );
}
```

**Faculty Approval**:

```typescript
// In faculty dashboard
async function approveEmail(emailId: string) {
  await supabase
    .from('pr_emails')
    .update({
      status: 'approved',
      faculty_approved_by: user.id,
      faculty_approved_at: new Date().toISOString()
    })
    .eq('id', emailId);
  
  await logApproval({
    user_id: user.id,
    user_role: 'faculty',
    entity_type: 'email',
    entity_id: emailId,
    action: 'approve',
    previous_status: 'pending_faculty_approval',
    new_status: 'approved'
  });
  
  toast.success('Email approved - PR can now send it');
}
```

### 4.2 Poster Approval Workflow

**File**: `app/dashboard/graphics/posters/page.tsx`

```typescript
'use client';

export default function PostersPage() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [uploading, setUploading] = useState(false);
  
  async function uploadPoster(file: File, eventId: string) {
    setUploading(true);
    
    // Upload to Supabase Storage
    const fileName = `${eventId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('posters')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const posterUrl = supabase.storage
      .from('posters')
      .getPublicUrl(fileName).data.publicUrl;
    
    // Create poster record
    await supabase.from('posters').insert({
      event_id: eventId,
      poster_url: posterUrl,
      uploaded_by: user.id,
      status: 'pending_faculty_approval'
    });
    
    toast.success('Poster uploaded and sent for approval');
    setUploading(false);
    loadPosters();
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Event Posters</h1>
      
      <PosterUploadZone onUpload={uploadPoster} loading={uploading} />
      
      <PosterGrid posters={posters} />
    </div>
  );
}
```

**Faculty Approval**:

```typescript
async function approvePoster(posterId: string) {
  await supabase
    .from('posters')
    .update({
      status: 'approved',
      faculty_approved_by: user.id,
      faculty_approved_at: new Date().toISOString()
    })
    .eq('id', posterId);
  
  await logApproval({
    user_id: user.id,
    user_role: 'faculty',
    entity_type: 'poster',
    entity_id: posterId,
    action: 'approve',
    previous_status: 'pending_faculty_approval',
    new_status: 'approved'
  });
  
  toast.success('Poster approved - now visible publicly');
}
```

## Part 5: Social & Environmental Control

### 5.1 Kick-Off Registration Control

**File**: `app/dashboard/kickoff/control/page.tsx`

```typescript
'use client';

export default function KickoffControlPage() {
  const [kickoffEnabled, setKickoffEnabled] = useState(false);
  const [registrationLink, setRegistrationLink] = useState('');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  
  async function toggleKickoff() {
    const newState = !kickoffEnabled;
    
    // Update kickoff settings
    await supabase
      .from('kickoff_settings')
      .upsert({
        event_id: currentEventId,
        enabled: newState,
        registration_link: newState ? generateRegistrationLink() : null
      });
    
    setKickoffEnabled(newState);
    
    if (newState) {
      const link = `${window.location.origin}/kickoff/register?event=${currentEventId}`;
      setRegistrationLink(link);
      toast.success('Registration opened! Link generated');
    } else {
      toast.success('Registration closed');
    }
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Kick-Off Control</h1>
      
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Registration Status</h2>
            <p className="text-gray-600">
              {kickoffEnabled ? 'Open' : 'Closed'}
            </p>
          </div>
          <Toggle
            checked={kickoffEnabled}
            onChange={toggleKickoff}
            size="large"
          />
        </div>
        
        {kickoffEnabled && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Registration Link:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={registrationLink}
                readOnly
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <Button onClick={() => copyToClipboard(registrationLink)}>
                Copy
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <RegistrationsList registrations={registrations} />
    </div>
  );
}
```

**Registration Form**:

```typescript
// app/kickoff/register/page.tsx
'use client';

export default function KickoffRegisterPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    checkIfEnabled();
  }, [eventId]);
  
  async function checkIfEnabled() {
    const { data } = await supabase
      .from('kickoff_settings')
      .select('enabled')
      .eq('event_id', eventId)
      .single();
    
    setEnabled(data?.enabled || false);
  }
  
  async function handleSubmit(data: RegistrationData) {
    await supabase.from('kickoff_registrations').insert({
      event_id: eventId,
      name: data.name,
      email: data.email,
      roll_number: data.roll_number,
      year: data.year,
      branch: data.branch,
      status: 'pending_approval'
    });
    
    toast.success('Registration submitted! Awaiting approval');
  }
  
  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Registration Closed
          </h1>
          <p className="text-gray-600">
            Registration for this event is currently closed.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto">
        <RegistrationForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
```

### 5.2 Registration Approval

**File**: `app/dashboard/environmental/approvals/page.tsx`

```typescript
'use client';

export default function RegistrationApprovalsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  
  async function bulkApprove() {
    await supabase
      .from('kickoff_registrations')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .in('id', selected);
    
    toast.success(`${selected.length} registrations approved`);
    setSelected([]);
    loadRegistrations();
  }
  
  async function rejectRegistration(id: string, reason: string) {
    await supabase
      .from('kickoff_registrations')
      .update({
        status: 'rejected',
        rejection_reason: reason
      })
      .eq('id', id);
    
    toast.success('Registration rejected');
    loadRegistrations();
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Registration Approvals</h1>
        <Button
          onClick={bulkApprove}
          disabled={selected.length === 0}
        >
          Approve Selected ({selected.length})
        </Button>
      </div>
      
      <RegistrationTable
        registrations={registrations}
        selected={selected}
        onSelect={setSelected}
        onReject={rejectRegistration}
      />
    </div>
  );
}
```

### 5.3 Schedule Management

**File**: `app/dashboard/environmental/schedule/page.tsx`

```typescript
'use client';

export default function ScheduleManagementPage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [editing, setEditing] = useState(false);
  
  async function saveSchedule(data: ScheduleData) {
    const { data: newSchedule } = await supabase
      .from('kickoff_schedules')
      .insert({
        event_id: currentEventId,
        schedule_data: data,
        version: (schedule?.version || 0) + 1,
        status: 'pending_approval'
      })
      .select()
      .single();
    
    // Auto-approve since Environmental committee creates it
    await supabase
      .from('kickoff_schedules')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', newSchedule.id);
    
    toast.success('Schedule updated and approved');
    setEditing(false);
    loadSchedule();
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Event Schedule</h1>
        <Button onClick={() => setEditing(true)}>
          {schedule ? 'Edit Schedule' : 'Create Schedule'}
        </Button>
      </div>
      
      {editing ? (
        <ScheduleEditor
          initialData={schedule?.schedule_data}
          onSave={saveSchedule}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ScheduleViewer schedule={schedule} />
      )}
    </div>
  );
}
```


## Part 6-11: Design Summary

### Part 6: Chat System
- Use Supabase Realtime for WebSocket connections
- 6 chat types with role-based access
- Message components: text, files, reactions, replies
- Real-time typing indicators and read receipts
- Pagination for message history (50 messages per page)

### Part 7: Forms Integration Fix
- Fix form_responses table foreign keys
- Sync kickoff registrations with form submissions
- Add duplicate prevention (unique constraint on user_id + form_id)

### Part 8: Meeting Module
- Two-step wizard: type selection → details
- Microsoft Graph API integration for Teams
- Auto-generate meeting emails
- Calendar view with RSVP tracking

### Part 9: Profile & Account Fixes
- Photo upload to `profile-photos` bucket
- Password change with validation
- Admin user management interface
- All admin actions logged

### Part 10: Role-Based Dashboards
- Dynamic dashboard component based on user role
- Role-specific navigation menu
- Permission-based feature visibility
- Real-time data updates via Supabase Realtime

### Part 11: Supabase Fixes
- Diagnose and fix edge function health
- Implement comprehensive RLS policies
- Ensure auth.users linked to profiles
- Create approval_logs and admin_actions tables

## Security Implementation

### RLS Policy Examples

```sql
-- Tasks: Committee members see only their assigned tasks
CREATE POLICY "committee_members_see_assigned_tasks"
ON tasks FOR SELECT
USING (
  assigned_to_committee_id IN (
    SELECT committee_id FROM committee_members
    WHERE user_id = auth.uid()
  )
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (executive_role IS NOT NULL OR is_faculty OR is_admin)
  )
);

-- Chat messages: Only group members can see messages
CREATE POLICY "group_members_see_messages"
ON chat_messages FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM chat_members
    WHERE user_id = auth.uid()
  )
);

-- Documents: Role-based access
CREATE POLICY "documents_role_based_access"
ON documents FOR SELECT
USING (
  uploaded_by = auth.uid()
  OR committee_id IN (
    SELECT committee_id FROM committee_members
    WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (executive_role IS NOT NULL OR is_faculty OR is_admin)
  )
);
```

### Permission Utility

```typescript
// lib/permissions.ts
export function canCreateTask(user: Profile, event: Event): boolean {
  // Proposing committee or EC can create tasks
  return (
    user.committee_members?.some(
      m => m.committee_id === event.committee_id && 
      ['co_head', 'head'].includes(m.position)
    ) ||
    user.executive_role !== null ||
    user.is_admin
  );
}

export function canApproveTask(user: Profile): boolean {
  return user.executive_role !== null || user.is_admin;
}

export function canViewFinance(user: Profile): boolean {
  return (
    user.executive_role !== null ||
    user.is_faculty ||
    user.is_admin
  );
}

export function canAccessChat(user: Profile, chatGroup: ChatGroup): boolean {
  if (chatGroup.type === 'personal') return true;
  if (chatGroup.type === 'organization') return true;
  if (chatGroup.type === 'executive') {
    return user.executive_role !== null || user.is_admin;
  }
  if (chatGroup.type === 'coheads') {
    return user.committee_members?.some(m => m.position === 'co_head') || user.is_admin;
  }
  if (chatGroup.type === 'committee') {
    return user.committee_members?.some(m => m.committee_id === chatGroup.committee_id);
  }
  if (chatGroup.type === 'custom') {
    return chatGroup.members?.some(m => m.user_id === user.id);
  }
  return false;
}
```

## Performance Optimization

### Database Indexes

```sql
-- Task queries
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_committee ON tasks(assigned_to_committee_id);
CREATE INDEX idx_tasks_event ON tasks(event_id);

-- Chat queries
CREATE INDEX idx_chat_messages_group_time ON chat_messages(group_id, created_at DESC);
CREATE INDEX idx_chat_members_user ON chat_members(user_id);

-- Document queries
CREATE INDEX idx_documents_filters ON documents(
  event_id, committee_id, task_id, uploaded_by
);
```

### Caching Strategy

```typescript
// Use React Query for client-side caching
export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetchTasks(filters),
    staleTime: 30000, // 30 seconds
    cacheTime: 300000 // 5 minutes
  });
}

// Use Supabase Realtime for live updates
export function useRealtimeTasks() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const subscription = supabase
      .channel('tasks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks'
      }, () => {
        queryClient.invalidateQueries(['tasks']);
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, []);
}
```

## Testing Strategy

### Unit Tests
- Permission functions (lib/permissions.ts)
- Utility functions (task-utils, chat-utils, etc.)
- Component logic (form validation, state management)

### Integration Tests
- Task creation → EC approval → execution flow
- Chat message sending and receiving
- Meeting creation with Teams integration
- Document upload and filtering

### E2E Tests
- Complete event workflow (propose → approve → tasks → complete)
- User registration and approval flow
- Chat conversation across multiple users
- Admin user management actions

## Deployment Strategy

### Phase 1: Critical (Week 1-2)
- Part 2: Task Assignment System
- Part 3: Faculty Dashboard
- Part 11: Supabase Fixes

### Phase 2: High Priority (Week 3-4)
- Part 4: PR & Graphics Control
- Part 5: Social & Environmental Control
- Part 7: Forms Integration Fix

### Phase 3: Medium Priority (Week 5-6)
- Part 8: Meeting Module
- Part 9: Profile & Account Fixes
- Part 10: Role-Based Dashboards

### Phase 4: Enhancement (Week 7-8)
- Part 6: Chat System

Each phase can be deployed independently with feature flags.

## Monitoring and Observability

### Metrics to Track
- Task approval time (creation → EC approval)
- Event completion rate
- Chat message delivery time
- Document upload success rate
- API response times
- Database query performance

### Logging
- All approval actions logged to approval_logs
- All admin actions logged to admin_actions
- Error logs with context (user, action, timestamp)
- Performance logs for slow queries

## Conclusion

This design provides a comprehensive technical architecture for the role-based system overhaul. The modular approach allows for phased implementation while maintaining system integrity. All features enforce strict role hierarchy and security through RLS policies and permission checks.

Key implementation priorities:
1. Establish solid foundation (Supabase fixes, RLS policies)
2. Build core workflows (tasks, approvals)
3. Enhance user experience (dashboards, chat)
4. Add advanced features (Teams integration, real-time updates)

Estimated total effort: 95-123 hours across 4 phases.
