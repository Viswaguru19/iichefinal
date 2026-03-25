'use client';

import { useMemo } from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { computeAttendanceSummary } from '@/lib/attendance-helpers';

interface AttendanceSummaryProps {
    attendance: any[];
    participants: any[];
    isManager: boolean;
    currentUserId: string;
}

export default function AttendanceSummary({
    attendance,
    participants,
    isManager,
    currentUserId,
}: AttendanceSummaryProps) {
    const summary = useMemo(
        () => computeAttendanceSummary(attendance, participants),
        [attendance, participants]
    );

    // Regular member: show only their own status
    if (!isManager) {
        const myRecord = attendance.find((r: any) => r.user_id === currentUserId);
        return (
            <div className="flex items-center gap-3 p-4 bg-white/50 rounded-xl">
                <div className={`w-3 h-3 rounded-full ${myRecord?.status === 'present' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-gray-700 capitalize">
                    {myRecord?.status ?? 'Not recorded'}
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Counts */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-2xl font-extrabold text-emerald-700">{summary.presentCount}</p>
                        <p className="text-xs text-emerald-600">Present</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                        <UserX className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-2xl font-extrabold text-red-700">{summary.absentCount}</p>
                        <p className="text-xs text-red-600">Absent</p>
                    </div>
                </div>
            </div>

            {/* Present list */}
            {summary.presentList.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Present</h4>
                    <div className="space-y-1.5">
                        {summary.presentList.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 p-2.5 bg-emerald-50/60 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{m.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Absent list */}
            {summary.absentList.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Absent</h4>
                    <div className="space-y-1.5">
                        {summary.absentList.map((m, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 bg-red-50/60 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700">{m.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {[m.committeeName, m.role].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
