// ============================================
// STRICT ROLE-BASED PERMISSION SYSTEM
// IIChE Student Chapter - AVV Coimbatore
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

export interface UserProfile {
    id: string;
    role: UserRole;
    executive_role?: ExecutiveRole | null;
    is_faculty: boolean;
    is_admin: boolean;
    is_active: boolean;
    committees?: string[]; // committee IDs
}

// ============================================
// CORE PERMISSION CHECKS
// ============================================

export function isAdmin(profile: UserProfile): boolean {
    return profile.is_admin === true;
}

export function isFaculty(profile: UserProfile): boolean {
    return profile.is_faculty === true;
}

export function isECMember(profile: UserProfile): boolean {
    return profile.executive_role !== null && profile.executive_role !== undefined;
}

export function isSecretary(profile: UserProfile): boolean {
    return profile.executive_role === 'secretary';
}

export function isTreasurer(profile: UserProfile): boolean {
    return profile.executive_role === 'treasurer' || profile.executive_role === 'associate_treasurer';
}

export function isCommitteeHead(profile: UserProfile): boolean {
    return profile.role === 'committee_head';
}

export function isCommitteeCoHead(profile: UserProfile): boolean {
    return profile.role === 'committee_cohead';
}

export function isCommitteeMember(profile: UserProfile): boolean {
    return profile.role === 'committee_member';
}

// ============================================
// EVENT PERMISSIONS
// ============================================

export function canProposeEvent(profile: UserProfile): boolean {
    // Only co-heads can propose events
    return isCommitteeCoHead(profile);
}

export function canApproveEventAsHead(profile: UserProfile, eventCommitteeId: string): boolean {
    // Committee heads can approve events from their committee
    return (
        isCommitteeHead(profile) &&
        Boolean(profile.committees?.includes(eventCommitteeId))
    );
}

export function canApproveEventAsFaculty(profile: UserProfile): boolean {
    // Faculty can approve all events
    return isFaculty(profile) || isAdmin(profile);
}

export function canViewEvent(profile: UserProfile, eventStatus: string, eventCommitteeId: string): boolean {
    // Active/completed events visible to all
    if (eventStatus === 'active' || eventStatus === 'completed') {
        return true;
    }

    // Committee members can see their committee's events
    if (profile.committees?.includes(eventCommitteeId)) {
        return true;
    }

    // EC, faculty, and admin can see all events
    return isECMember(profile) || isFaculty(profile) || isAdmin(profile);
}

// ============================================
// TASK PERMISSIONS
// ============================================

export function canCreateTask(profile: UserProfile, committeeId: string): boolean {
    // Committee heads and co-heads can create tasks
    return (
        (isCommitteeHead(profile) || isCommitteeCoHead(profile)) &&
        Boolean(profile.committees?.includes(committeeId))
    );
}

export function canApproveTask(profile: UserProfile): boolean {
    // Only EC members can approve tasks
    return isECMember(profile);
}

export function canUpdateTaskStatus(profile: UserProfile, assignedCommitteeId: string): boolean {
    // Members of assigned committee can update task status
    return Boolean(profile.committees?.includes(assignedCommitteeId));
}

export function canViewTask(profile: UserProfile, proposedCommitteeId: string, assignedCommitteeId: string): boolean {
    // Can view if part of proposed or assigned committee
    if (
        profile.committees?.includes(proposedCommitteeId) ||
        profile.committees?.includes(assignedCommitteeId)
    ) {
        return true;
    }

    // EC, faculty, and admin can view all tasks
    return isECMember(profile) || isFaculty(profile) || isAdmin(profile);
}

// ============================================
// DOCUMENT PERMISSIONS
// ============================================

export function canUploadDocument(profile: UserProfile, committeeId: string): boolean {
    // Committee members can upload documents for their committee
    return Boolean(profile.committees?.includes(committeeId));
}

export function canViewDocument(profile: UserProfile, documentCommitteeId: string): boolean {
    // Can view if part of committee
    if (profile.committees?.includes(documentCommitteeId)) {
        return true;
    }

    // EC, faculty, and admin can view all documents
    return isECMember(profile) || isFaculty(profile) || isAdmin(profile);
}

export function canDeleteDocument(profile: UserProfile, uploaderId: string): boolean {
    // Can delete own documents or if admin
    return profile.id === uploaderId || isAdmin(profile);
}

// ============================================
// PR & GRAPHICS PERMISSIONS
// ============================================

export function canDraftPREmail(profile: UserProfile, prCommitteeId: string): boolean {
    // Only PR committee members can draft emails
    return Boolean(profile.committees?.includes(prCommitteeId));
}

export function canApprovePREmail(profile: UserProfile): boolean {
    // Only faculty can approve PR emails
    return isFaculty(profile) || isAdmin(profile);
}

export function canUploadPoster(profile: UserProfile, graphicsCommitteeId: string): boolean {
    // Only Graphics/Design committee members can upload posters
    return Boolean(profile.committees?.includes(graphicsCommitteeId));
}

export function canApprovePoster(profile: UserProfile): boolean {
    // Only faculty can approve posters
    return isFaculty(profile) || isAdmin(profile);
}

// ============================================
// KICKOFF PERMISSIONS
// ============================================

export function canControlKickoff(profile: UserProfile, environmentalCommitteeId: string): boolean {
    // Environmental/Social committee heads can control kickoff
    return (
        (isCommitteeHead(profile) || isCommitteeCoHead(profile)) &&
        Boolean(profile.committees?.includes(environmentalCommitteeId))
    ) || isAdmin(profile);
}

export function canApproveKickoffTeam(profile: UserProfile, environmentalCommitteeId: string): boolean {
    // Environmental committee can approve teams
    return Boolean(profile.committees?.includes(environmentalCommitteeId)) || isAdmin(profile);
}

export function canApproveKickoffSchedule(profile: UserProfile, environmentalCommitteeId: string): boolean {
    // Environmental committee can approve schedule
    return Boolean(profile.committees?.includes(environmentalCommitteeId)) || isAdmin(profile);
}

// ============================================
// FINANCE PERMISSIONS
// ============================================

export function canSubmitFinanceTransaction(profile: UserProfile, committeeId: string): boolean {
    // Committee members can submit transactions
    return Boolean(profile.committees?.includes(committeeId));
}

export function canApproveFinanceTransaction(profile: UserProfile): boolean {
    // Treasurer or faculty can approve
    return isTreasurer(profile) || isFaculty(profile) || isAdmin(profile);
}

export function canViewFinanceOverview(profile: UserProfile): boolean {
    // EC, faculty, and admin can view finance overview
    return isECMember(profile) || isFaculty(profile) || isAdmin(profile);
}

// ============================================
// MEETING PERMISSIONS
// ============================================

export function canCreateMeeting(profile: UserProfile): boolean {
    // Committee heads, co-heads, EC members, and admin can create meetings
    return (
        isCommitteeHead(profile) ||
        isCommitteeCoHead(profile) ||
        isECMember(profile) ||
        isAdmin(profile)
    );
}

export function canViewMeeting(profile: UserProfile, meetingParticipants: string[], meetingCreatorId: string): boolean {
    // Can view if invited, creator, EC, faculty, or admin
    return (
        meetingParticipants.includes(profile.id) ||
        profile.id === meetingCreatorId ||
        isECMember(profile) ||
        isFaculty(profile) ||
        isAdmin(profile)
    );
}

export function canUpdateMeeting(profile: UserProfile, meetingCreatorId: string): boolean {
    // Creator or admin can update
    return profile.id === meetingCreatorId || isAdmin(profile);
}

// ============================================
// CHAT PERMISSIONS
// ============================================

export type ChatType = 'personal' | 'committee' | 'organization' | 'executive' | 'coheads' | 'custom_group';

export function canAccessChat(profile: UserProfile, chatType: ChatType, chatCommitteeId?: string): boolean {
    switch (chatType) {
        case 'personal':
            return true; // Everyone can access personal chats

        case 'committee':
            return chatCommitteeId ? profile.committees?.includes(chatCommitteeId) || false : false;

        case 'organization':
            return true; // All authenticated users can access org chat

        case 'executive':
            return isECMember(profile) || isAdmin(profile);

        case 'coheads':
            return isCommitteeCoHead(profile) || isAdmin(profile);

        case 'custom_group':
            return true; // Access controlled by group membership

        default:
            return false;
    }
}

export function canCreateCustomGroup(profile: UserProfile): boolean {
    // Anyone can create custom groups
    return true;
}

export function canSendMessage(profile: UserProfile, groupId: string, groupParticipants: string[]): boolean {
    // Can send if part of group
    return groupParticipants.includes(profile.id);
}

// ============================================
// FORM PERMISSIONS
// ============================================

export function canCreateForm(profile: UserProfile): boolean {
    // Committee heads, co-heads, and admin can create forms
    return (
        isCommitteeHead(profile) ||
        isCommitteeCoHead(profile) ||
        isAdmin(profile)
    );
}

export function canViewFormResponses(profile: UserProfile, formCreatorId: string, respondentId: string): boolean {
    // Form creator, respondent, or admin can view responses
    return (
        profile.id === formCreatorId ||
        profile.id === respondentId ||
        isAdmin(profile)
    );
}

// ============================================
// ADMIN PERMISSIONS
// ============================================

export function canManageUsers(profile: UserProfile): boolean {
    return isAdmin(profile);
}

export function canChangeUserRole(profile: UserProfile): boolean {
    return isAdmin(profile);
}

export function canViewApprovalLogs(profile: UserProfile): boolean {
    return isECMember(profile) || isFaculty(profile) || isAdmin(profile);
}

export function canConfigureWorkflow(profile: UserProfile): boolean {
    return isAdmin(profile);
}

export function canOverrideApproval(profile: UserProfile): boolean {
    return isAdmin(profile);
}

// ============================================
// DASHBOARD PERMISSIONS
// ============================================

export function getDashboardPermissions(profile: UserProfile) {
    return {
        // View permissions
        canViewTasks: true,
        canViewEvents: true,
        canViewDocuments: true,
        canViewMeetings: true,
        canViewChat: true,

        // Action permissions
        canProposeEvent: canProposeEvent(profile),
        canCreateTask: isCommitteeHead(profile) || isCommitteeCoHead(profile),
        canApproveTask: canApproveTask(profile),
        canCreateMeeting: canCreateMeeting(profile),
        canCreateForm: canCreateForm(profile),

        // Special permissions
        canAccessFacultyDashboard: isFaculty(profile),
        canAccessAdminPanel: isAdmin(profile),
        canAccessECDashboard: isECMember(profile),
        canAccessFinance: canViewFinanceOverview(profile),

        // Approval permissions
        canApproveEvents: isFaculty(profile) || isCommitteeHead(profile),
        canApproveTasks: isECMember(profile),
        canApprovePREmails: canApprovePREmail(profile),
        canApprovePosters: canApprovePoster(profile),
        canApproveFinance: canApproveFinanceTransaction(profile),
        canApproveKickoff: isAdmin(profile),

        // Role info
        role: profile.role,
        executiveRole: profile.executive_role,
        isFaculty: isFaculty(profile),
        isAdmin: isAdmin(profile),
        isEC: isECMember(profile),
    };
}

// ============================================
// ROLE HIERARCHY
// ============================================

export const ROLE_HIERARCHY: Record<UserRole, number> = {
    admin: 100,
    faculty_advisor: 90,
    secretary: 80,
    joint_secretary: 75,
    associate_secretary: 70,
    associate_joint_secretary: 65,
    treasurer: 60,
    associate_treasurer: 55,
    committee_head: 50,
    committee_cohead: 40,
    committee_member: 30,
};

export function hasHigherRole(profile1: UserProfile, profile2: UserProfile): boolean {
    return ROLE_HIERARCHY[profile1.role] > ROLE_HIERARCHY[profile2.role];
}

export function canManageUser(manager: UserProfile, targetUser: UserProfile): boolean {
    // Admin can manage anyone
    if (isAdmin(manager)) return true;

    // Faculty can manage non-admin, non-faculty users
    if (isFaculty(manager) && !isAdmin(targetUser) && !isFaculty(targetUser)) return true;

    // EC members can manage committee members
    if (isECMember(manager) && isCommitteeMember(targetUser)) return true;

    // Committee heads can manage their committee members
    if (isCommitteeHead(manager) && isCommitteeMember(targetUser)) {
        // Check if same committee (would need committee data)
        return true;
    }

    return false;
}
