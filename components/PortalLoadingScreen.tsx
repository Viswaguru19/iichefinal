'use client';

import { useEffect, useState } from 'react';
import GradientText from '@/components/react-bits/GradientText';
import GradientMesh from '@/components/react-bits/GradientMesh';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

const LETTERS = ['I', 'I', 'C', 'h', 'E'] as const;

/** Portal loader with React Bits–style gradient mesh + gradient brand text. */
export default function PortalLoadingScreen({
  message = 'Loading portal…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const [visibleCount, setVisibleCount] = useState<number>(0);

  useEffect(() => {
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
        <GradientText
          className="portal-loader-brand-text !mx-0 text-sm font-extrabold tracking-[0.28em] uppercase"
          colors={['#5eead4', '#67e8f9', '#a5b4fc', '#5eead4']}
          animationSpeed={6}
        >
          AVVU SC
        </GradientText>
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
      <GradientMesh
        className="opacity-80"
        colors={['rgba(45,212,191,0.28)', 'rgba(56,189,248,0.22)', 'rgba(129,140,248,0.18)']}
      />
      <div className="portal-loader-bg-grid" aria-hidden />
      {card}
    </div>
  );
}
