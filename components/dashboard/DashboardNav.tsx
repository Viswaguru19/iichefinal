'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import DynamicLogo from '@/components/DynamicLogo';
import NotificationBell from '@/components/dashboard/NotificationBell';

interface DashboardNavProps {
    userName: string;
    userRole: string;
}

export default function DashboardNav({ userName, userRole }: DashboardNavProps) {
    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="sticky top-0 z-50 glass-strong shadow-lg shadow-indigo-500/5"
        >
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
                {/* Top row: logo + actions */}
                <div className="flex justify-between h-14 sm:h-16 items-center">
                    <Link href="/dashboard" className="flex items-center gap-2 group flex-shrink-0">
                        <motion.div whileHover={{ rotate: 10, scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}>
                            <DynamicLogo width={32} height={32} />
                        </motion.div>
                        <h1 className="text-base sm:text-2xl font-bold text-gradient">IIChE AVVU SC</h1>
                    </Link>
                    <div className="flex items-center gap-1.5 sm:gap-4">
                        <NotificationBell />
                        <Link href="/dashboard/profile" className="text-gray-600 hover:text-indigo-600 transition-colors font-medium text-xs sm:text-sm">Profile</Link>
                        <span className="text-gray-700 font-medium text-xs sm:text-sm truncate max-w-[150px] hidden sm:block">{userName}</span>
                        <span className="text-[9px] sm:text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-semibold shadow-sm whitespace-nowrap hidden sm:inline-flex">
                            {userRole.replace('_', ' ').toUpperCase()}
                        </span>
                        <form action="/api/auth/signout" method="POST">
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                type="submit"
                                className="text-gray-400 hover:text-rose-500 transition-colors"
                            >
                                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                            </motion.button>
                        </form>
                    </div>
                </div>
            </div>
        </motion.nav>
    );
}
