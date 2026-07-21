'use client';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

export default function PortalLoadingScreen({
  message = 'Loading portal…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const card = (
    <div className={`portal-loader-shell ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <div className="portal-loader-shimmer" aria-hidden />
      <div className="portal-loader-orbit" aria-hidden>
        <span className="portal-loader-ring portal-loader-ring-1" />
        <span className="portal-loader-ring portal-loader-ring-2" />
        <span className="portal-loader-ring portal-loader-ring-3" />
        <span className="portal-loader-core" />
      </div>
      <p className="portal-loader-brand-text">IIChE AVVU SC</p>
      <p className="portal-loader-tagline">Student Chapter Portal</p>
      <p className="portal-loader-message">{message}</p>
      <div className="portal-loader-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );

  if (!fullPage) return card;

  return (
    <div className="portal-loader-page portal-fade-in">
      <div className="portal-loader-bg-orb portal-loader-bg-orb-1" aria-hidden />
      <div className="portal-loader-bg-orb portal-loader-bg-orb-2" aria-hidden />
      {card}
    </div>
  );
}
