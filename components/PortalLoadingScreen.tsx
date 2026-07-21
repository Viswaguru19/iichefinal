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
    <div className={`portal-loader-shell ${className}`.trim()}>
      <div className="portal-loader-glow" aria-hidden />
      <div className="portal-loader-logo-stage">
        <img
          src="/icons/iiche-app-icon.svg"
          alt="IIChE AVVU SC"
          className="portal-loader-brand-logo"
          width={120}
          height={120}
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <p className="portal-loader-brand-text">IIChE AVVU SC</p>
      <p className="portal-loader-message">{message}</p>
      <div className="portal-loader-track" aria-hidden>
        <div className="portal-loader-track-fill" />
      </div>
    </div>
  );

  if (!fullPage) return card;

  return <div className="portal-loader-page portal-fade-in">{card}</div>;
}
