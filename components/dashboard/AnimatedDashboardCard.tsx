'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Users, Calendar, Trophy, DollarSign, Crown, Send, MessageSquare, CheckCircle, FileText
} from 'lucide-react';
import { motionTokens } from '@/lib/ui/motion';

const iconMap = {
    Users, Calendar, Trophy, DollarSign, Crown, Send, MessageSquare, CheckCircle, FileText
}; const GRADIENT_MAP: Record<string, string> = {
    'blue-600': 'from-blue-500 to-indigo-600',
    'green-600': 'from-emerald-500 to-teal-600',
    'purple-600': 'from-violet-500 to-purple-600',
    'yellow-600': 'from-amber-400 to-orange-500',
    'red-600': 'from-rose-500 to-red-600',
    'indigo-600': 'from-indigo-500 to-blue-600',
    'orange-600': 'from-orange-400 to-amber-600',
    'emerald-600': 'from-emerald-500 to-green-600',
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
    badge?: number;
}

export default function AnimatedDashboardCard({
    href, iconName, title, description,
    gradient = false, gradientFrom = 'blue-600', gradientTo = 'blue-700',
    iconColor = 'blue-600', index = 0, badge
}: AnimatedDashboardCardProps) {
    const Icon = iconMap[iconName];
    const iconGradient = GRADIENT_MAP[iconColor] || 'from-blue-500 to-indigo-600';

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: index * 0.05, ease: motionTokens.easing }}
            whileHover={{ y: motionTokens.hoverCard.y, transition: { duration: 0.2, ease: motionTokens.easing } }}
        >
            <Link
                href={href}
                className={`group block rounded-2xl p-6 transition-all duration-300 relative overflow-hidden ${gradient
                    ? `bg-gradient-to-br from-${gradientFrom} to-${gradientTo} text-white shadow-lg hover:shadow-2xl`
                    : 'premium-card shadow-md hover:shadow-xl'
                    }`}
            >
                {/* Decorative orb */}
                <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-all duration-500 group-hover:opacity-40 group-hover:scale-150 ${gradient ? 'bg-white' : 'bg-gradient-to-br from-indigo-400 to-purple-400'
                    }`} />

                <motion.div
                    whileHover={motionTokens.hoverIcon}
                    transition={{ duration: 0.2, ease: motionTokens.easing }}
                    className="relative z-10"
                >
                    {gradient ? (
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                            <Icon className="w-6 h-6" />
                        </div>
                    ) : (
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center mb-4 shadow-md`}>
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                    )}
                </motion.div>
                <h3 className={`text-lg font-bold relative z-10 ${gradient ? 'text-white' : 'text-gray-900'}`}>
                    {title}
                    {badge != null && badge > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-red-500 text-white">
                            {badge > 99 ? '99+' : badge}
                        </span>
                    )}
                </h3>
                <p className={`text-sm mt-1.5 relative z-10 ${gradient ? 'text-white/80' : 'text-gray-500'}`}>
                    {description}
                </p>
            </Link>
        </motion.div>
    );
}
