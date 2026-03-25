'use client';

import { useState, useMemo } from 'react';
import { Loader2, CheckCircle2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface OnlineAttendanceViewProps {
    meetingId: string;
    participants: any[];
    existingAttendance: any[];
    isManager: boolean;
    onRefresh: () => void;
}

export default function OnlineAttendanceView({
    meetingId,
    participants,
    existingAttendance,
    isManager,
    onRefresh,
}: OnlineAttendanceViewProps) {
    const initialStatuses = useMemo(() => {
        const map: Record<string, 'present' | 'absent'> = {};
        for (const p of participants) {
            const rec = existingAttendance.find((a: any) => a.user_id === p.id);
            map[p.id] = rec?.status ?? 'absent';
        }
        return map;
    }, [participants, existingAttendance]);

    const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent'>>(initialStatuses);
    const [saving, setSaving] = useState<string | null>(null);
    const [finalizing, setFinalizing] = useState(false);
    const [finalized, setFinalized] = useState(false);

    async function toggleStatus(userId: string) {
        const newStatus = statuses[userId] === 'present' ? 'absent' : 'present';
        setStatuses(prev => ({ ...prev, [userId]: newStatus }));
        setSaving(userId);
        try {
            const res = await fetch('/api/meetings/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetingId,
                    records: [{ userId, status: newStatus }],
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update status');
            }
        } catch (err: any) {
            // Revert on error
            setStatuses(prev => ({ ...prev, [userId]: statuses[userId] }));
            toast.error(err.message || 'Failed to update status');
        } finally {
            setSaving(null);
        }
    }

    async function finalizeAttendance() {
        setFinalizing(true);
        try {
            const records = participants.map(p => ({
                userId: p.id,
                status: statuses[p.id],
            }));
            const res = await fetch('/api/meetings/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId, records, submit: true }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to finalize attendance');
            }
            toast.success('Attendance finalized');
            setFinalized(true);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to finalize attendance');
        } finally {
            setFinalizing(false);
        }
    }

    const presentCount = Object.values(statuses).filter(s => s === 'present').length;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                    {presentCount} of {participants.length} present
                </p>
            </div>

            <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-1">
                {participants.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No participants found.</p>
                ) : (
                    participants.map(p => {
                        const isPresent = statuses[p.id] === 'present';
                        const isSaving = saving === p.id;
                        return (
                            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/40">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPresent ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                                    {p.committeeName && (
                                        <p className="text-xs text-gray-400 truncate">{p.committeeName}</p>
                                    )}
                                </div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPresent ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                                    }`}>
                                    {isPresent ? 'Present' : 'Absent'}
                                </span>
                                {isManager && (
                                    <button
                                        onClick={() => toggleStatus(p.id)}
                                        disabled={isSaving || finalized}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${isPresent
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                            }`}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : isPresent ? 'Mark Absent' : 'Mark Present'}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {isManager && (
                <button
                    onClick={finalizeAttendance}
                    disabled={finalizing || finalized || participants.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all
            bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20
            hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {finalizing ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Finalizing...</>
                    ) : finalized ? (
                        <><CheckCircle2 className="w-4 h-4" /> Finalized</>
                    ) : (
                        <><Send className="w-4 h-4" /> Finalize Attendance</>
                    )}
                </button>
            )}
        </div>
    );
}
