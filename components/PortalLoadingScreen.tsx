'use client';

import PageHeader from '@/components/PageHeader';

/** Kept for existing call sites. */
export type LoaderVariant = 'home' | 'events' | 'community' | 'resources' | 'updates';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
  variant?: LoaderVariant;
}

/** Instant page chrome + placeholders — no brand splash on navigation. */
export default function PortalLoadingScreen({
  message = 'Loading…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const body = (
    <div className={`max-w-7xl mx-auto px-4 ${fullPage ? 'py-8' : 'py-4'} relative z-10`}>
      <div className="premium-card rounded-2xl h-12 mb-6 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="premium-panel rounded-2xl h-44 animate-pulse" />
        ))}
      </div>
    </div>
  );

  if (!fullPage) {
    return (
      <div className={className} role="status" aria-live="polite" aria-busy="true" aria-label={message}>
        {body}
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-mesh relative overflow-hidden ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <PageHeader title="IIChE AVVU SC" gradientTitle />
      {body}
    </div>
  );
}
