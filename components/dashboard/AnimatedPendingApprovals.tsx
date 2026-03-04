'use client';

import { motion } from 'framer-motion';

interface PendingApproval {
    id: string;
    title: string;
    committees?: {
        name: string;
    };
}

interface AnimatedPendingApprovalsProps {
    approvals: PendingApproval[];
}

export default function AnimatedPendingApprovals({ approvals }: AnimatedPendingApprovalsProps) {
    if (approvals.length === 0) {
        return (
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-600 text-center py-4"
            >
                No pending head approvals
            </motion.p>
        );
    }

    return (
        <div className="space-y-3">
            {approvals.map((event, index) => (
                <motion.div
                    key={event.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        duration: 0.3,
                        delay: index * 0.08,
                        ease: [0.25, 0.1, 0.25, 1]
                    }}
                    whileHover={{ scale: 1.02 }}
                    className="flex justify-between items-center p-3 border border-yellow-200 bg-yellow-50 rounded-lg"
                >
                    <div>
                        <h4 className="font-bold text-gray-900">{event.title}</h4>
                        <p className="text-sm text-gray-600">{event.committees?.name}</p>
                    </div>
                    <motion.span
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.08 + 0.2 }}
                        className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold"
                    >
                        WAITING FOR HEAD APPROVAL
                    </motion.span>
                </motion.div>
            ))}
        </div>
    );
}
