'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import DynamicLogo from '@/components/DynamicLogo';
import NotificationBell from '@/components/dashboard/NotificationBell';

interface DashboardNavProps {
    userName: string;
    userRole: string;
}

export default function DashboardNav({ userName, userRole }: DashboardNavProps) {
    return (
        <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <DynamicLogo width={40} height={40} />
                        <h1 className="text-2xl font-bold text-blue-600">IIChE AVVU Dashboard</h1>
                    </Link>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                        <Link href="/dashboard/profile" className="text-gray-700 hover:text-blue-600">Profile</Link>
                        <span className="text-gray-700">{userName}</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {userRole.replace('_', ' ').toUpperCase()}
                        </span>
                        <form action="/api/auth/signout" method="POST">
                            <button type="submit" className="text-gray-600 hover:text-red-600">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </nav>
    );
}
