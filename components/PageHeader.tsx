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
                <div className="flex justify-between h-[64px] sm:h-[74px] items-center gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Link href="/dashboard" className="flex items-center gap-2.5 group">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/85 border border-white/80 shadow-sm flex items-center justify-center">
                                <DynamicLogo width={42} height={42} />
                            </div>
                            <span className="text-base font-extrabold text-gradient portal-header-brand hidden sm:inline">IIChE AVVU SC</span>
                        </Link>
                        <div className="w-px h-6 bg-gray-200 portal-header-divider hidden sm:block" />
                        <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate portal-header-title">{title}</h1>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <AdminOnlinePresenceControls />
                        {rightContent}
                        {showBack && (
                            <button onClick={() => router.back()} className="flex items-center gap-1 text-[11px] sm:text-xs text-gray-600 hover:text-indigo-700 transition-colors font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-50 portal-header-link">
                                <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Back</span>
                            </button>
                        )}
                        <Link href="/dashboard" className="flex items-center gap-1 text-[11px] sm:text-xs text-gray-600 hover:text-indigo-700 transition-colors font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-50 portal-header-link">
                            <LayoutDashboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                    </div>
                </div>
            </div>
        </motion.nav>
    );
}
