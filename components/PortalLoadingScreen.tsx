'use client';

import { useEffect, useState } from 'react';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

const LETTERS = ['I', 'I', 'C', 'h', 'E'] as const;

/** Lightweight loader — CSS only (no Google font round-trips). */
export default function PortalLoadingScreen({
  message = 'Loading portal…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const [visibleCount, setVisibleCount] = useState(LETTERS.length);

  useEffect(() => {
    // One-shot reveal only (no endless letter reset — felt like endless loading)
    setVisibleCount(0);
    const timers = LETTERS.map((_, i) =>
      setTimeout(() => setVisibleCount(i + 1), 70 * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const card = (
    <div
      className={`portal-loader-shell ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="portal-loader-orbit" aria-hidden>
        <span className="portal-loader-orbit-ring portal-loader-orbit-ring-a" />
        <span className="portal-loader-orbit-ring portal-loader-orbit-ring-b" />
        <span className="portal-loader-orbit-bead" />
      </div>

      <div className="portal-loader-core">
        <div className="portal-loader-iiche" aria-label="IIChE">
          {LETTERS.map((letter, i) => (
            <span
              key={`${letter}-${i}`}
              className={`portal-loader-letter ${i < visibleCount ? 'is-in' : ''}`}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      <div className="portal-loader-meta">
        <p className="portal-loader-brand-text">AVVU SC</p>
        <p className="portal-loader-tagline">Student Chapter Portal</p>
        <p className="portal-loader-message">{message}</p>
        <div className="portal-loader-track" aria-hidden>
          <span className="portal-loader-track-fill" />
        </div>
      </div>
    </div>
  );

  if (!fullPage) return card;

  return (
    <div className="portal-loader-page portal-fade-in">
      <div className="portal-loader-bg-grid" aria-hidden />
      <div className="portal-loader-bg-orb portal-loader-bg-orb-1" aria-hidden />
      <div className="portal-loader-bg-orb portal-loader-bg-orb-2" aria-hidden />
      {card}
    </div>
  );
}
