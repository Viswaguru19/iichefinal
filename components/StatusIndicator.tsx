'use client';

import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { getOverdueStatus } from '@/lib/reminder-eligibility';

interface StatusIndicatorProps {
    entityType: 'approval' | 'task';
    timestamp: string | Date | null;
    currentStatus: string;
    showBellAnimation?: boolean;
}

const STATUS_CONFIG = {
    overdue: { bg: 'bg-red-100 text-red-700', label: 'Overdue' },
    pending: { bg: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
    normal: { bg: 'bg-green-100 text-green-700', label: 'On Track' },
} as const;

export default function StatusIndicator({
    entityType,
    timestamp,
    currentStatus,
    showBellAnimation = false,
}: StatusIndicatorProps) {
    const status = getOverdueStatus(entityType, timestamp, currentStatus);
    const config = STATUS_CONFIG[status];

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg}`}
        >
            {config.label}
            {showBellAnimation && (
                <motion.span
                    animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex"
                >
                    <Bell className="w-3 h-3" />
                </motion.span>
            )}
        </span>
    );
}
