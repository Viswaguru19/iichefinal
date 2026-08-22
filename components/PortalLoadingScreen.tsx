'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

/** Sleek minimal loader — clean mark, thin arc, soft progress. */
export default function PortalLoadingScreen({
  message = 'Loading…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const mark = root.querySelector<HTMLElement>('[data-pl-mark]');
      const ring = root.querySelector<HTMLElement>('[data-pl-ring]');
      const lines = root.querySelectorAll<HTMLElement>('[data-pl-line]');
      const bar = root.querySelector<HTMLElement>('[data-pl-bar]');

      gsap.set([mark, ...lines], { opacity: 0, y: 12 });
      gsap.set(ring, { opacity: 0, scale: 0.92 });

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.to(ring, { opacity: 1, scale: 1, duration: 0.45 })
        .to(mark, { opacity: 1, y: 0, duration: 0.5 }, '-=0.2')
        .to(lines, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, '-=0.25');

      if (ring) {
        gsap.to(ring, { rotation: 360, duration: 1.1, ease: 'none', repeat: -1 });
      }
      if (bar) {
        gsap.fromTo(
          bar,
          { scaleX: 0.15, xPercent: -120 },
          { scaleX: 0.45, xPercent: 220, duration: 1.15, ease: 'power1.inOut', repeat: -1 },
        );
      }
    },
    { scope: rootRef, dependencies: [message] },
  );

  const content = (
    <div
      ref={rootRef}
      className={`pl-root ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pl-spinner" aria-hidden>
        <svg className="pl-spinner-svg" viewBox="0 0 80 80" fill="none">
          <circle className="pl-spinner-track" cx="40" cy="40" r="34" />
          <circle data-pl-ring className="pl-spinner-arc" cx="40" cy="40" r="34" />
        </svg>
        <div data-pl-mark className="pl-mark" aria-label="IIChE">
          IIChE
        </div>
      </div>

      <p data-pl-line className="pl-brand">
        AVVU SC
      </p>
      <p data-pl-line className="pl-message">
        {message}
      </p>
      <div data-pl-line className="pl-bar-track" aria-hidden>
        <span data-pl-bar className="pl-bar-fill" />
      </div>
    </div>
  );

  if (!fullPage) {
    return <div className="pl-inline">{content}</div>;
  }

  return <div className="pl-page">{content}</div>;
}
