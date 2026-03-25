'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import ReminderConfirmationModal from '@/components/ReminderConfirmationModal';

interface ReminderButtonProps {
    entityId: string;
    entityType: 'approval' | 'task';
}

export default function ReminderButton({ entityId, entityType }: ReminderButtonProps) {
    const [visible, setVisible] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [justSent, setJustSent] = useState(false);

    useEffect(() => {
        async function check() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, executive_role, is_faculty, is_admin')
                    .eq('id', user.id)
                    .single();
                if (!profile) return;

                const isEC = !!profile.executive_role;
                const isFaculty = !!profile.is_faculty || !!profile.is_admin;

                if (isEC || isFaculty) {
                    setVisible(true);
                } else if (entityType === 'task') {
                    const { data: taskRows } = await supabase
                        .from('task_assignments')
                        .select('event_id')
                        .eq('id', entityId)
                        .limit(1);
                    const task = taskRows?.[0];
                    if (task?.event_id) {
                        const { data: eventRows } = await supabase
                            .from('events')
                            .select('created_by, committee_id')
                            .eq('id', task.event_id)
                            .limit(1);
                        const event = eventRows?.[0];
                        if (event?.created_by === user.id) {
                            setVisible(true);
                        } else if (event?.committee_id) {
                            const { data: mem } = await supabase
                                .from('committee_members')
                                .select('user_id')
                                .eq('committee_id', event.committee_id)
                                .eq('user_id', user.id)
                                .limit(1);
                            if (mem && mem.length > 0) setVisible(true);
                        }
                    }
                } else {
                    const { data: eventRows } = await supabase
                        .from('events')
                        .select('created_by')
                        .eq('id', entityId)
                        .limit(1);
                    if (eventRows?.[0]?.created_by === user.id) setVisible(true);
                }
            } catch (err) {
                console.error('[ReminderButton] error:', err);
            }
        }
        check();
    }, [entityId, entityType]);

    if (!visible) return null;

    const handleConfirm = async () => {
        setSending(true);
        try {
            const res = await fetch('/api/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entityId, entityType }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Failed to send reminder');
                return;
            }
            toast.success('Reminder sent!');
            setModalOpen(false);
            setJustSent(true);
            setTimeout(() => setJustSent(false), 800);
        } catch {
            toast.error('Failed to send reminder');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="inline-flex flex-col items-start gap-1">
            <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
            >
                <motion.span
                    animate={justSent ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
                    transition={{ duration: 0.6 }}
                    className="inline-flex"
                >
                    <Bell className="w-4 h-4" />
                </motion.span>
                Remind
            </button>
            <ReminderConfirmationModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={handleConfirm}
                sending={sending}
                entityType={entityType}
            />
        </div>
    );
}
