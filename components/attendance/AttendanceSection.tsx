'use client';

import { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import AttendanceSummary from './AttendanceSummary';
import OfflineAttendanceForm from './OfflineAttendanceForm';
import OnlineAttendanceView from './OnlineAttendanceView';

interface AttendanceSectionProps {
    meeting: any;
    currentUser: any;
    attendance: any[];
    participants: any[];
    isManager: boolean;
    onRefresh: () => void;
}

export default function AttendanceSection({
    meeting,
    currentUser,
    attendance,
    participants,
    isManager,
    onRefresh,
}: AttendanceSectionProps) {
    const isSubmitted = useMemo(
        () => attendance.some((r: any) => r.submitted === true),
        [attendance]
    );

    // If submitted, show summary for everyone
    if (isSubmitted) {
        return (
            <div className="premium-panel rounded-2xl p-6 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-bold text-gray-800">Attendance</h3>
                    <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                        Submitted
                    </span>
                </div>
                <AttendanceSummary
                    attendance={attendance}
                    participants={participants}
                    isManager={isManager}
                    currentUserId={currentUser?.id}
                />
            </div>
        );
    }

    // Manager view: show form/controls
    if (isManager) {
        return (
            <div className="premium-panel rounded-2xl p-6 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-bold text-gray-800">Manage Attendance</h3>
                </div>
                {meeting.meeting_type === 'offline' ? (
                    <OfflineAttendanceForm
                        meetingId={meeting.id}
                        participants={participants}
                        existingAttendance={attendance}
                        onSubmitted={onRefresh}
                    />
                ) : (
                    <OnlineAttendanceView
                        meetingId={meeting.id}
                        participants={participants}
                        existingAttendance={attendance}
                        isManager={isManager}
                        onRefresh={onRefresh}
                    />
                )}
            </div>
        );
    }

    // Regular member: show only their own status
    const myRecord = attendance.find((r: any) => r.user_id === currentUser?.id);

    return (
        <div className="premium-panel rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-gray-800">Your Attendance</h3>
            </div>
            {myRecord ? (
                <div className="flex items-center gap-3 p-4 bg-white/50 rounded-xl">
                    <div className={`w-3 h-3 rounded-full ${myRecord.status === 'present' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium text-gray-700 capitalize">{myRecord.status}</span>
                </div>
            ) : (
                <p className="text-sm text-gray-400">Attendance has not been recorded yet.</p>
            )}
        </div>
    );
}
