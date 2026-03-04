'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Users, Calendar, Trophy, DollarSign, Crown, Send, MessageSquare
} from 'lucide-react';

const iconMap = {
    Users,
    Calendar,
    Trophy,
    DollarSign,
    Crown,
    Send,
    MessageSquare
};

interface AnimatedDashboardCardProps {
    href: string;
    iconName: keyof typeof iconMap;
    title: string;
    description: string;
    gradient?: boolean;
    gradientFrom?: string;
    gradientTo?: string;
    iconColor?: string;
    index?: number;
}

export default function AnimatedDashboardCard({
    href,
    iconName,
    title,
    description,
    gradient = false,
    gradientFrom = 'blue-600',
    gradientTo = 'blue-700',
    iconColor = 'blue-600',
    index = 0
}: AnimatedDashboardCardProps) {
    const Icon = iconMap[iconName];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: index * 0.05,
                ease: [0.25, 0.1, 0.25, 1]
            }}
            whileHover={{
                y: -4,
                transition: { duration: 0.2 }
            }}
        >
            <Link
                href={href}
                className={`block rounded-xl shadow-md p-6 transition-all duration-300 ${gradient
                        ? `bg-gradient-to-r from-${gradientFrom} to-${gradientTo} text-white hover:shadow-xl`
                        : 'bg-white hover:shadow-lg'
                    }`}
            >
                <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.2 }}
                >
                    <Icon className={`w-8 h-8 mb-4 ${gradient ? '' : `text-${iconColor}`}`} />
                </motion.div>
                <h3 className={`text-lg font-bold ${gradient ? 'text-white' : 'text-gray-900'}`}>
                    {title}
                </h3>
                <p className={`text-sm mt-2 ${gradient ? 'text-white/90' : 'text-gray-600'}`}>
                    {description}
                </p>
            </Link>
        </motion.div>
    );
}
