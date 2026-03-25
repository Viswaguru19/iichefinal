'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ReminderConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    sending: boolean;
    entityType: 'approval' | 'task';
}

export default function ReminderConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    sending,
    entityType,
}: ReminderConfirmationModalProps) {
    const message =
        entityType === 'approval'
            ? 'This will notify the pending approver(s) about this request.'
            : 'This will notify the assigned committee members.';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Send Reminder?
                        </h3>
                        <p className="text-sm text-gray-600 mb-6">{message}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={onClose}
                                disabled={sending}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={sending}
                                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {sending ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    'Send Reminder'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
