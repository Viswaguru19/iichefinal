'use client';

import { useEffect, useState } from 'react';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

const LETTERS = ['I', 'I', 'C', 'H', 'E'] as const;
/** Stagger: I → I → C → H → E */
const LETTER_DELAY_MS = 160;
const DOT_DELAY_AFTER_LETTER_MS = 120;

export default function PortalLoadingScreen({
  message = 'Loading portal…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [dotsOn, setDotsOn] = useState(false);

  useEffect(() => {
    setVisibleCount(0);
    setDotsOn(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    LETTERS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), LETTER_DELAY_MS * (i + 1)));
    });
    // After both I's are on screen, draw the tittle dots via circle
    timers.push(
      setTimeout(() => setDotsOn(true), LETTER_DELAY_MS * 2 + DOT_DELAY_AFTER_LETTER_MS),
    );
    // Loop the sequence so long loads keep animating
    const loop = setInterval(() => {
      setVisibleCount(0);
      setDotsOn(false);
      LETTERS.forEach((_, i) => {
        timers.push(setTimeout(() => setVisibleCount(i + 1), LETTER_DELAY_MS * (i + 1)));
      });
      timers.push(
        setTimeout(() => setDotsOn(true), LETTER_DELAY_MS * 2 + DOT_DELAY_AFTER_LETTER_MS),
      );
    }, LETTER_DELAY_MS * LETTERS.length + 1200);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, []);

  const card = (
    <div className={`portal-loader-shell ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <div className="portal-loader-shimmer" aria-hidden />

      <div className="portal-loader-iiche" aria-label="IIChE">
        {LETTERS.map((letter, i) => {
          const show = i < visibleCount;
          const isI = letter === 'I';
          return (
            <span
              key={`${letter}-${i}`}
              className={`portal-loader-letter ${show ? 'is-in' : ''} ${isI ? 'is-i' : ''}`}
              data-letter={letter}
            >
              <span className="portal-loader-letter-glyph" aria-hidden>
                {isI ? <span className="portal-loader-i-stem" /> : letter}
              </span>
              {isI && (
                <span
                  className={`portal-loader-i-dot ${dotsOn && show ? 'is-on' : ''}`}
                  aria-hidden
                >
                  <span className="portal-loader-i-dot-ring" />
                  <span className="portal-loader-i-dot-core" />
                </span>
              )}
            </span>
          );
        })}
      </div>

      <p className="portal-loader-brand-text">AVVU SC</p>
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
