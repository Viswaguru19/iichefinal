// ============================================
// DATABASE TYPES
// Auto-generated from Supabase schema
// ============================================

export type UserRole =
  | 'admin'
  | 'faculty_advisor'
  | 'secretary'
  | 'joint_secretary'
  | 'associate_secretary'
  | 'associate_joint_secretary'
  | 'treasurer'
  | 'associate_treasurer'
  | 'committee_head'
  | 'committee_cohead'
  | 'committee_member';

export type ExecutiveRole =
  | 'secretary'
  | 'joint_secretary'
  | 'associate_secretary'
  | 'associate_joint_secretary'
  | 'treasurer'
  | 'associate_treasurer';

export type TaskStatus =
  | 'draft'
  | 'pending_ec_approval'
  | 'ec_approved'
  | 'ec_rejected'
  | 'not_started'
  | 'in_progress'
  | 'partially_completed'
  | 'completed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type EventStatus =
  | 'draft'
  | 'pending_head_approval'
  | 'pending_faculty_approval'
  | 'faculty_approved'
  | 'active'
  | 'completed'
  | 'cancelled';

export type ApprovalStatus =
  | 'draft'
  | 'pending_faculty'
  | 'faculty_approved'
  | 'faculty_rejected'
  | 'published';

export type ChatType =
  | 'personal'
  | 'committee'
  | 'organization'
  | 'executive'
  | 'coheads'
  | 'custom_group';

export type MeetingType = 'online' | 'offline';

export type MeetingPlatform = 'microsoft_teams' | 'google_meet' | 'zoom' | 'other';

export type DocumentType =
  | 'task_document'
  | 'event_document'
  | 'poster'
  | 'email_draft'
  | 'meeting_minutes'
  | 'finance_document'
  | 'general';

export type TransactionType = 'income' | 'expense' | 'budget_allocation';

export type FinanceApprovalStatus = 'pending' | 'approved' | 'rejected';

// ============================================
// TABLE INTERFACES
// ============================================

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  executive_role?: ExecutiveRole | null;
  is_faculty: boolean;
  is_admin: boolean;
  is_active: boolean;
  avatar_url?: string | null;
  phone?: string | null;
  department?: string | null;
  year?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Committee {
  id: string;
  name: string;
  description?: string | null;
  type: 'regular' | 'executive';
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommitteeMember {
  id: string;
  user_id: string;
  committee_id: string;
  position: 'head' | 'co_head' | 'member';
  designation?: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  committee_id?: string | null;
  event_date: string;
  location?: string | null;
  image_url?: string | null;
  status: EventStatus;
  proposed_by?: string | null;
  created_by?: string | null;
  head_approved_by?: string | null;
  head_approved_at?: string | null;
  faculty_approved_by?: string | null;
  faculty_approved_at?: string | null;
  budget?: number | null;
  finance_approved: boolean;
  finance_approved_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  event_id?: string | null;
  proposed_by_committee_id?: string | null;
  assigned_to_committee_id?: string | null;
  created_by?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string | null;
  ec_approved_by?: string | null;
  ec_approved_at?: string | null;
  ec_rejection_reason?: string | null;
  documents: any[];
  created_at: string;
  updated_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  user_id?: string | null;
  update_text: string;
  status_change?: TaskStatus | null;
  documents: any[];
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  document_type: DocumentType;
  uploaded_by?: string | null;
  committee_id?: string | null;
  event_id?: string | null;
  task_id?: string | null;
  year?: number | null;
  month?: number | null;
  tags?: string[] | null;
  metadata?: any | null;
  created_at: string;
}

export interface PREmail {
  id: string;
  event_id?: string | null;
  subject: string;
  body: string;
  recipients?: string[] | null;
  drafted_by?: string | null;
  status: ApprovalStatus;
  faculty_approved_by?: string | null;
  faculty_approved_at?: string | null;
  faculty_rejection_reason?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Poster {
  id: string;
  event_id?: string | null;
  title: string;
  poster_url: string;
  uploaded_by?: string | null;
  status: ApprovalStatus;
  faculty_approved_by?: string | null;
  faculty_approved_at?: string | null;
  faculty_rejection_reason?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KickoffConfig {
  id: string;
  registration_enabled: boolean;
  registration_link?: string | null;
  current_tournament_id?: string | null;
  controlled_by_committee_id?: string | null;
  updated_by?: string | null;
  updated_at: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  chat_type: ChatType;
  committee_id?: string | null;
  created_by?: string | null;
  avatar_url?: string | null;
  description?: string | null;
  created_at: string;
}

export interface ChatParticipant {
  id: string;
  group_id: string;
  user_id: string;
  is_admin: boolean;
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  sender_id?: string | null;
  message?: string | null;
  file_url?: string | null;
  file_type?: string | null;
  reply_to?: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  meeting_type: MeetingType;
  meeting_date: string;
  duration?: number | null;
  location?: string | null;
  platform?: MeetingPlatform | null;
  meeting_link?: string | null;
  created_by?: string | null;
  committee_id?: string | null;
  participants?: string[] | null;
  agenda?: string | null;
  minutes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  event_id?: string | null;
  committee_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  receipt_url?: string | null;
  submitted_by?: string | null;
  approval_status: FinanceApprovalStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface ApprovalLog {
  id: string;
  user_id?: string | null;
  user_role?: UserRole | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  metadata?: any | null;
  created_at: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string | null;
  event_id?: string | null;
  created_by?: string | null;
  fields: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  user_id?: string | null;
  responses: any;
  submitted_at: string;
}

// ============================================
// JOINED TYPES (with relations)
// ============================================

export interface ProfileWithCommittees extends Profile {
  committees: CommitteeMember[];
}

export interface TaskWithRelations extends Task {
  proposed_by_committee?: Committee;
  assigned_to_committee?: Committee;
  event?: Event;
  created_by_profile?: Profile;
  updates?: TaskUpdate[];
}

export interface EventWithRelations extends Event {
  committee?: Committee;
  proposed_by_profile?: Profile;
  tasks?: Task[];
  posters?: Poster[];
}

export interface ChatGroupWithParticipants extends ChatGroup {
  participants: (ChatParticipant & { profile: Profile })[];
  last_message?: ChatMessage;
  unread_count?: number;
}

export interface MeetingWithParticipants extends Meeting {
  participant_profiles?: Profile[];
  creator_profile?: Profile;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// FILTER TYPES
// ============================================

export interface DocumentFilters {
  year?: number;
  month?: number;
  event_id?: string;
  committee_id?: string;
  task_id?: string;
  uploaded_by?: string;
  document_type?: DocumentType;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to_committee_id?: string;
  proposed_by_committee_id?: string;
  event_id?: string;
}

export interface EventFilters {
  status?: EventStatus;
  committee_id?: string;
  date_from?: string;
  date_to?: string;
}
