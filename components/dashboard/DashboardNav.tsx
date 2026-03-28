'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, Moon, Sun, User } from 'lucide-react';
import { motion } from 'framer-motion';
import DynamicLogo from '@/components/DynamicLogo';
import NotificationBell from '@/components/dashboard/NotificationBell';
import { motionTokens } from '@/lib/ui/motion';

interface DashboardNavProps {
    userName: string;
    userRole: string;
}

export default function DashboardNav({ userName, userRole }: DashboardNavProps) {
    const [portalTheme, setPortalTheme] = useState<'dark-gradient' | 'light-gradient'>('dark-gradient');

    useEffect(() => {
        try {
            const saved = localStorage.getItem('portal-theme');
            if (saved === 'light-gradient') setPortalTheme('light-gradient');
        } catch { }
    }, []);

    const applyTheme = (theme: 'dark-gradient' | 'light-gradient') => {
        setPortalTheme(theme);
        try {
            localStorage.setItem('portal-theme', theme);
            document.documentElement.setAttribute('data-portal-theme', theme === 'light-gradient' ? 'light' : 'dark');
        } catch { }
    };

    const toggleTheme = () => {
        applyTheme(portalTheme === 'dark-gradient' ? 'light-gradient' : 'dark-gradient');
    };

    return (
        <motion.nav
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...motionTokens.enter, ease: motionTokens.easing }}
            className="sticky top-0 z-50 premium-panel"
        >
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
                {/* Top row: logo + actions */}
                <div className="flex justify-between h-16 sm:h-[74px] items-center gap-2">
                    <Link href="/dashboard" className="flex items-center gap-2 group flex-shrink-0 min-w-0">
                        <motion.div whileHover={motionTokens.hoverIcon} transition={{ duration: 0.2, ease: motionTokens.easing }}>
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/85 border border-white/80 shadow-sm flex items-center justify-center">
                                <DynamicLogo width={38} height={38} />
                            </div>
                        </motion.div>
                        <h1 className="text-base sm:text-2xl font-bold text-gradient portal-header-brand truncate">IIChE AVVU SC</h1>
                    </Link>
                    <div className="flex items-center gap-1.5 sm:gap-4">
                        <NotificationBell />
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-white/70 hover:bg-white text-gray-700 transition-colors portal-header-link"
                            title={portalTheme === 'dark-gradient' ? 'Switch to White Gradient' : 'Switch to Black Gradient'}
                        >
                            {portalTheme === 'dark-gradient' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <Link
                            href="/dashboard/profile"
                            title="Profile"
                            aria-label="Profile"
                            className="flex items-center justify-center gap-1.5 p-2 rounded-lg sm:px-2 sm:py-2 text-gray-600 hover:text-indigo-600 hover:bg-white/60 transition-colors portal-header-link border border-transparent hover:border-white/40"
                        >
                            <User className="w-4 h-4 shrink-0" aria-hidden />
                            <span className="hidden sm:inline text-sm font-medium">Profile</span>
                        </Link>
                        <span className="text-gray-700 font-medium text-xs sm:text-sm truncate max-w-[150px] hidden sm:block portal-header-link">{userName || 'Member'}</span>
                        <span className="text-[9px] sm:text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-semibold shadow-sm whitespace-nowrap hidden sm:inline-flex">
                            {(userRole || 'member').replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <form action="/api/auth/signout" method="POST">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={motionTokens.tap}
                                type="submit"
                                className="text-gray-400 hover:text-rose-500 transition-colors portal-header-link"
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
