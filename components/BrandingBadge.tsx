'use client';

import DynamicLogo from '@/components/DynamicLogo';

interface BrandingBadgeProps {
  className?: string;
}

export default function BrandingBadge({ className = '' }: BrandingBadgeProps) {
  return (
    <div className={`premium-panel rounded-2xl p-3 sm:p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <DynamicLogo width={34} height={34} />
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900 leading-tight">IIChE AVVU SC</p>
          <p className="text-xs text-indigo-600/90 font-medium truncate">Fueled by Passion, Driven by Students</p>
        </div>
      </div>
    </div>
  );
}

