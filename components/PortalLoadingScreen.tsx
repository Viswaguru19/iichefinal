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

/**
 * Unified portal loader — soft bloom, dual arcs, clean wordmark.
 * Use everywhere so pages never show the old purple pulse.
 */
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

      const bloom = root.querySelector<HTMLElement>('[data-pl-bloom]');
      const ringA = root.querySelector<HTMLElement>('[data-pl-ring-a]');
      const ringB = root.querySelector<HTMLElement>('[data-pl-ring-b]');
      const mark = root.querySelector<HTMLElement>('[data-pl-mark]');
      const lines = root.querySelectorAll<HTMLElement>('[data-pl-fade]');
      const dots = root.querySelectorAll<HTMLElement>('[data-pl-dot]');

      gsap.set(bloom, { opacity: 0, scale: 0.7 });
      gsap.set([ringA, ringB], { opacity: 0, scale: 0.88 });
      gsap.set(mark, { opacity: 0, y: 10 });
      gsap.set(lines, { opacity: 0, y: 8 });
      gsap.set(dots, { opacity: 0.25, scale: 0.7 });

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.to(bloom, { opacity: 1, scale: 1, duration: 0.55 })
        .to([ringA, ringB], { opacity: 1, scale: 1, duration: 0.45, stagger: 0.06 }, '-=0.3')
        .to(mark, { opacity: 1, y: 0, duration: 0.4 }, '-=0.2')
        .to(lines, { opacity: 1, y: 0, duration: 0.35, stagger: 0.07 }, '-=0.2')
        .to(dots, { opacity: 1, scale: 1, duration: 0.3 }, '-=0.15');

      if (ringA) gsap.to(ringA, { rotation: 360, duration: 1.35, ease: 'none', repeat: -1 });
      if (ringB) gsap.to(ringB, { rotation: -360, duration: 2.1, ease: 'none', repeat: -1 });
      if (bloom) {
        gsap.to(bloom, {
          scale: 1.08,
          opacity: 0.85,
          duration: 2.2,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }
      if (dots.length) {
        gsap.to(dots, {
          opacity: 0.25,
          y: -3,
          duration: 0.55,
          yoyo: true,
          repeat: -1,
          stagger: 0.14,
          ease: 'sine.inOut',
        });
      }
    },
    { scope: rootRef, dependencies: [message] },
  );

  const body = (
    <div
      ref={rootRef}
      className={`pl-root ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pl-orbiter" aria-hidden>
        <div data-pl-bloom className="pl-bloom" />
        <svg className="pl-svg" viewBox="0 0 96 96" fill="none">
          <circle className="pl-track" cx="48" cy="48" r="40" />
          <circle data-pl-ring-a className="pl-arc pl-arc-a" cx="48" cy="48" r="40" />
          <circle className="pl-track pl-track-inner" cx="48" cy="48" r="30" />
          <circle data-pl-ring-b className="pl-arc pl-arc-b" cx="48" cy="48" r="30" />
        </svg>
        <div data-pl-mark className="pl-mark">
          IIChE
        </div>
      </div>

      <p data-pl-fade className="pl-brand">
        AVVU Student Chapter
      </p>
      <p data-pl-fade className="pl-message">
        {message}
      </p>
      <div data-pl-fade className="pl-dots" aria-hidden>
        <span data-pl-dot className="pl-dot" />
        <span data-pl-dot className="pl-dot" />
        <span data-pl-dot className="pl-dot" />
      </div>
    </div>
  );

  if (!fullPage) {
    return <div className="pl-inline">{body}</div>;
  }

  return <div className="pl-page">{body}</div>;
}
