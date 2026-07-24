'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import DynamicLogo from '@/components/DynamicLogo';
import { motion } from 'framer-motion';
import { motionTokens } from '@/lib/ui/motion';
import AdminOnlinePresenceControls from '@/components/dashboard/AdminOnlinePresenceControls';

interface PageHeaderProps {
    title: string;
    showBack?: boolean;
    rightContent?: React.ReactNode;
}

export default function PageHeader({ title, showBack = true, rightContent }: PageHeaderProps) {
    const router = useRouter();

    return (
        <motion.nav
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...motionTokens.enter, ease: motionTokens.easing }}
            className="sticky top-0 z-40 premium-panel"
        >
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
                <div className="flex justify-between h-[64px] sm:h-[74px] items-center gap-2 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                        <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-white/85 border border-white/80 shadow-sm flex items-center justify-center">
                                <DynamicLogo width={42} height={42} />
                            </div>
                            <span className="text-base font-extrabold text-gradient portal-header-brand hidden md:inline">IIChE AVVU SC</span>
                        </Link>
                        <div className="w-px h-6 bg-gray-200 portal-header-divider hidden md:block" />
                        <h1 className="text-sm sm:text-xl font-bold text-gray-900 truncate portal-header-title min-w-0">{title}</h1>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 max-w-[55%] sm:max-w-none overflow-x-auto mobile-clean-scroll">
                        <AdminOnlinePresenceControls />
                        {rightContent && (
                            <div className="hidden sm:contents">{rightContent}</div>
                        )}
                        {showBack && (
                            <button onClick={() => router.back()} className="flex items-center gap-1 text-[11px] sm:text-xs text-gray-600 hover:text-indigo-700 transition-colors font-semibold px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-50 portal-header-link">
                                <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Back</span>
                            </button>
                        )}
                        <Link href="/dashboard" className="flex items-center gap-1 text-[11px] sm:text-xs text-gray-600 hover:text-indigo-700 transition-colors font-semibold px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-50 portal-header-link">
                            <LayoutDashboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                    </div>
                </div>
                {rightContent && (
                    <div className="sm:hidden pb-2.5 -mt-1 flex flex-wrap gap-2">
                        {rightContent}
                    </div>
                )}
            </div>
        </motion.nav>
    );
}
