'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import DynamicLogo from '@/components/DynamicLogo';

interface PageHeaderProps {
    title: string;
    showBack?: boolean;
    rightContent?: React.ReactNode;
}

export default function PageHeader({ title, showBack = true, rightContent }: PageHeaderProps) {
    const router = useRouter();

    return (
        <nav className="sticky top-0 z-40 glass-strong shadow-lg shadow-indigo-500/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-14 items-center">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="flex items-center gap-2 group">
                            <DynamicLogo width={36} height={36} />
                            <span className="text-sm font-bold text-gradient hidden sm:inline">IIChE AVVU SC</span>
                        </Link>
                        <div className="w-px h-6 bg-gray-200" />
                        <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {rightContent}
                        {showBack && (
                            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50">
                                <ArrowLeft className="w-3.5 h-3.5" /> Back
                            </button>
                        )}
                        <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50">
                            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
