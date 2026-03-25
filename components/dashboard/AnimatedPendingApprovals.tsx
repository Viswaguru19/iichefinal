'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface AnimatedPendingApprovalsProps {
    approvals: { id: string; title: string; committees?: { name: string } }[];
}

export default function AnimatedPendingApprovals({ approvals }: AnimatedPendingApprovalsProps) {
    if (approvals.length === 0) {
        return (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-gray-400 text-center py-6 font-medium">
                No pending head approvals
            </motion.p>
        );
    }

    return (
        <div className="space-y-3">
            {approvals.map((event, index) => (
                <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                    whileHover={{ scale: 1.015, x: 4 }}
                    className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 group hover:shadow-md transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                            <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-sm">{event.title}</h4>
                            <p className="text-xs text-gray-500">{event.committees?.name}</p>
                        </div>
                    </div>
                    <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: index * 0.08 + 0.2 }}
                        className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full font-bold shadow-sm"
                    >
                        AWAITING HEAD
                    </motion.span>
                </motion.div>
            ))}
        </div>
    );
}
