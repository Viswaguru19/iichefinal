'use client';

import { useState, useMemo } from 'react';
import { CheckSquare, Square, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface OfflineAttendanceFormProps {
    meetingId: string;
    participants: any[];
    existingAttendance: any[];
    onSubmitted: () => void;
}

export default function OfflineAttendanceForm({
    meetingId,
    participants,
    existingAttendance,
    onSubmitted,
}: OfflineAttendanceFormProps) {
    // Build initial checked state from existing attendance
    const initialChecked = useMemo(() => {
        const map: Record<string, boolean> = {};
        for (const p of participants) {
            const existing = existingAttendance.find((a: any) => a.user_id === p.id);
            map[p.id] = existing?.status === 'present';
        }
        return map;
    }, [participants, existingAttendance]);

    const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    function toggle(userId: string) {
        setChecked(prev => ({ ...prev, [userId]: !prev[userId] }));
    }

    function selectAll() {
        const all: Record<string, boolean> = {};
        participants.forEach(p => { all[p.id] = true; });
        setChecked(all);
    }

    function deselectAll() {
        const none: Record<string, boolean> = {};
        participants.forEach(p => { none[p.id] = false; });
        setChecked(none);
    }

    async function handleSubmit() {
        setSubmitting(true);
        try {
            const records = participants.map(p => ({
                userId: p.id,
                status: checked[p.id] ? 'present' : 'absent',
            }));

            const res = await fetch('/api/meetings/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId, records, submit: true }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to submit attendance');
            }

            toast.success('Attendance submitted successfully');
            setSubmitted(true);
            onSubmitted();
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit attendance');
        } finally {
            setSubmitting(false);
        }
    }

    const presentCount = Object.values(checked).filter(Boolean).length;

    return (
        <div>
            {/* Quick actions */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                    {presentCount} of {participants.length} marked present
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={selectAll}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        Select All
                    </button>
                    <button
                        onClick={deselectAll}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Deselect All
                    </button>
                </div>
            </div>

            {/* Participant list */}
            <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-1">
                {participants.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No participants found.</p>
                ) : (
                    participants.map(p => (
                        <button
                            key={p.id}
                            onClick={() => toggle(p.id)}
                            disabled={submitted}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/60 transition-colors text-left group"
                        >
                            {checked[p.id] ? (
                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                                {p.committeeName && (
                                    <p className="text-xs text-gray-400 truncate">{p.committeeName}</p>
                                )}
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${checked[p.id]
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-red-50 text-red-500'
                                }`}>
                                {checked[p.id] ? 'Present' : 'Absent'}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {/* Submit button */}
            <button
                onClick={handleSubmit}
                disabled={submitting || submitted || participants.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all
          bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20
          hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                ) : submitted ? (
                    <><CheckSquare className="w-4 h-4" /> Submitted</>
                ) : (
                    <><Square className="w-4 h-4" /> Submit Attendance</>
                )}
            </button>
        </div>
    );
}
