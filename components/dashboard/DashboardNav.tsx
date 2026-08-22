'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { LogOut, Moon, Sun, User } from 'lucide-react';
import DynamicLogo from '@/components/DynamicLogo';
import AdminOnlinePresenceControls from '@/components/dashboard/AdminOnlinePresenceControls';
import GradientText from '@/components/react-bits/GradientText';

const NotificationBell = dynamic(() => import('@/components/dashboard/NotificationBell'), {
  ssr: false,
  loading: () => <div className="w-9 h-9 rounded-lg bg-white/50 animate-pulse" aria-hidden />,
});

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
    } catch {
      // ignore
    }
  }, []);

  const applyTheme = (theme: 'dark-gradient' | 'light-gradient') => {
    setPortalTheme(theme);
    try {
      localStorage.setItem('portal-theme', theme);
      document.documentElement.setAttribute('data-portal-theme', theme === 'light-gradient' ? 'light' : 'dark');
    } catch {
      // ignore
    }
  };

  return (
    <nav className="sticky top-0 z-50 premium-panel portal-safe-top portal-nav-in">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 sm:h-[74px] items-center gap-2 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 group min-w-0 flex-1 overflow-hidden">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/85 border border-white/80 shadow-sm flex items-center justify-center shrink-0">
              <DynamicLogo width={38} height={38} />
            </div>
            <h1 className="text-sm sm:text-2xl font-bold portal-header-brand truncate max-[380px]:hidden">
              <GradientText
                className="!mx-0 text-sm sm:text-2xl font-bold"
                colors={['#0f766e', '#2563eb', '#0891b2', '#0f766e']}
                animationSpeed={9}
              >
                IIChE AVVU SC
              </GradientText>
            </h1>
          </Link>
          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
            <AdminOnlinePresenceControls />
            <NotificationBell />
            <button
              type="button"
              onClick={() => applyTheme(portalTheme === 'dark-gradient' ? 'light-gradient' : 'dark-gradient')}
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
            <span className="text-gray-700 font-medium text-xs sm:text-sm truncate max-w-[150px] hidden sm:block portal-header-link">
              {userName || 'Member'}
            </span>
            <span className="text-[9px] sm:text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-semibold shadow-sm whitespace-nowrap hidden sm:inline-flex">
              {(userRole || 'member').replace(/_/g, ' ').toUpperCase()}
            </span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-gray-400 hover:text-rose-500 transition-colors portal-header-link p-1"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
