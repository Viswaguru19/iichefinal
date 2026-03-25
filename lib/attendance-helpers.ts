import type { Profile } from '@/types/database';

/**
 * Returns true if the user is an Attendance Manager
 * (EC member, faculty, or admin).
 */
export function isAttendanceManager(
    profile: Pick<Profile, 'executive_role' | 'is_faculty' | 'is_admin'>
): boolean {
    return (
        profile.executive_role != null ||
        profile.is_faculty === true ||
        profile.is_admin === true
    );
}

export interface AttendanceSummary {
    presentCount: number;
    absentCount: number;
    presentList: { name: string }[];
    absentList: { name: string; committeeName: string | null; role: string }[];
}

/**
 * Computes attendance summary from records and participant profiles.
 *
 * @param records  - Array of { user_id, status } attendance records
 * @param participants - Array of participant profiles with id, name, role,
 *                       and optional committeeName
 */
export function computeAttendanceSummary(
    records: { user_id: string; status: 'present' | 'absent' }[],
    participants: {
        id: string;
        name: string;
        role: string;
        committeeName?: string | null;
    }[]
): AttendanceSummary {
    const statusMap = new Map<string, 'present' | 'absent'>();
    for (const r of records) {
        statusMap.set(r.user_id, r.status);
    }

    const presentList: { name: string }[] = [];
    const absentList: { name: string; committeeName: string | null; role: string }[] = [];

    for (const p of participants) {
        const status = statusMap.get(p.id) ?? 'absent';
        if (status === 'present') {
            presentList.push({ name: p.name });
        } else {
            absentList.push({
                name: p.name,
                committeeName: p.committeeName ?? null,
                role: p.role,
            });
        }
    }

    return {
        presentCount: presentList.length,
        absentCount: absentList.length,
        presentList,
        absentList,
    };
}
