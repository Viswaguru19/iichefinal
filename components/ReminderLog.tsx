'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatPortalDateTime } from '@/lib/portal-date';

interface ReminderEntry {
    id: string;
    senderName: string;
    createdAt: string;
}

interface ReminderLogProps {
    entityId: string;
}

export default function ReminderLog({ entityId }: ReminderLogProps) {
    const [entries, setEntries] = useState<ReminderEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function fetchReminders() {
            setLoading(true);
            try {
                const supabase = createClient();
                const { data } = await supabase
                    .from('reminders')
                    .select('id, created_at, sent_by, profiles:sent_by(name)')
                    .eq('proposal_id', entityId)
                    .order('created_at', { ascending: false });

                if (cancelled) return;

                const mapped: ReminderEntry[] = (data ?? []).map((r: any) => ({
                    id: r.id,
                    senderName: r.profiles?.name ?? 'Unknown',
                    createdAt: formatPortalDateTime(r.created_at),
                }));

                setEntries(mapped);
            } catch {
                // silently fail
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchReminders();
        return () => { cancelled = true; };
    }, [entityId]);

    if (loading) {
        return <p className="text-xs text-gray-400">Loading reminders…</p>;
    }

    if (entries.length === 0) {
        return <p className="text-xs text-gray-400">No reminders sent yet</p>;
    }

    return (
        <ul className="space-y-1">
            {entries.map((entry) => (
                <li key={entry.id} className="text-xs text-gray-600">
                    🔔 Reminder sent by {entry.senderName} at {entry.createdAt}
                </li>
            ))}
        </ul>
    );
}
