'use client';

import { useEffect, useState } from 'react';
import { Syne, Outfit } from 'next/font/google';

const display = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
});

const body = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

const LETTERS = ['I', 'I', 'C', 'h', 'E'] as const;
const LETTER_DELAY_MS = 90;

export default function PortalLoadingScreen({
  message = 'Loading portal…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setVisibleCount(0);
      LETTERS.forEach((_, i) => {
        timers.push(setTimeout(() => setVisibleCount(i + 1), LETTER_DELAY_MS * (i + 1)));
      });
    };
    run();
    const loop = setInterval(run, LETTER_DELAY_MS * LETTERS.length + 1600);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, []);

  const card = (
    <div
      className={`portal-loader-shell ${display.className} ${className}`.trim()}
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

      <div className={`portal-loader-meta ${body.className}`}>
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
