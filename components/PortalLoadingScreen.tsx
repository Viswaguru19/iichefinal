'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import DynamicLogo from '@/components/DynamicLogo';

gsap.registerPlugin(useGSAP);

/** Kept for existing call sites; every loader now uses the same brand screen. */
export type LoaderVariant = 'home' | 'events' | 'community' | 'resources' | 'updates';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
  variant?: LoaderVariant;
}

function readPortalTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-portal-theme');
  if (attr === 'light') return 'light';
  if (attr === 'dark') return 'dark';
  try {
    return localStorage.getItem('portal-theme') === 'light-gradient' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Latest brand loading screen — same design on every route, light/dark aware. */
export default function PortalLoadingScreen({
  message = 'Loading…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => readPortalTheme());
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const t = readPortalTheme();
    setTheme(t);
    const onStorage = () => setTheme(readPortalTheme());
    window.addEventListener('storage', onStorage);
    const obs = new MutationObserver(() => setTheme(readPortalTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-portal-theme'] });
    return () => {
      window.removeEventListener('storage', onStorage);
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    setProgress(12 + Math.floor(Math.random() * 18));
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return 88 + Math.floor(Math.random() * 5);
        return Math.min(92, p + 3 + Math.floor(Math.random() * 7));
      });
    }, 420);
    return () => window.clearInterval(id);
  }, [message]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const fade = root.querySelectorAll<HTMLElement>('[data-pl-fade]');
      const ring = root.querySelector<HTMLElement>('[data-pl-ring]');
      const bar = root.querySelector<HTMLElement>('[data-pl-bar]');
      gsap.set(fade, { opacity: 0, y: 10 });
      gsap.set(ring, { opacity: 0, scale: 0.92 });
      gsap.to(fade, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' });
      gsap.to(ring, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' });
      if (ring) gsap.to(ring, { rotation: 360, duration: 2.4, ease: 'none', repeat: -1 });
      if (bar) {
        gsap.fromTo(
          bar,
          { backgroundPosition: '0% 50%' },
          { backgroundPosition: '100% 50%', duration: 1.6, ease: 'none', repeat: -1 },
        );
      }
    },
    { scope: rootRef, dependencies: [theme] },
  );

  const body = (
    <div ref={rootRef} className={`pl-root pl-variant-home ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <div data-pl-fade className="pl-home-brand">
        <div className="pl-home-logo-wrap">
          <span data-pl-ring className="pl-home-glow-ring" aria-hidden />
          <DynamicLogo width={72} height={72} className="pl-logo-img pl-logo-lg" />
        </div>
        <p className="pl-brand-name pl-brand-name-lg">
          <span className="pl-brand-iiche">IIChE</span> <span className="pl-brand-avvu">AVVU SC</span>
        </p>
        <p className="pl-tagline">IGNITE · INNOVATE · INSPIRE</p>
      </div>

      <div data-pl-fade className="pl-skyline" aria-hidden>
        <svg viewBox="0 0 320 72" className="pl-skyline-svg" fill="none">
          <path
            className="pl-skyline-line"
            d="M8 58 V34 H18 V58 M28 58 V22 H42 V58 M48 58 V40 H62 V28 H74 V58 M86 58 V18 H98 V10 H108 V18 H118 V58 M130 58 V36 H148 V58 M158 58 V24 H168 V14 H178 V24 H190 V58 M200 58 V30 H220 V58 M230 58 V20 Q245 6 260 20 V58 M270 58 V34 H290 V58 M298 58 V42 H312 V58"
            strokeWidth="1.4"
          />
        </svg>
      </div>

      <p data-pl-fade className="pl-motto">
        Engineering Solutions. <span>Sustainable</span> Tomorrow.
      </p>

      <div data-pl-fade className="pl-progress-wrap pl-progress-home">
        <div className="pl-progress-track">
          <div data-pl-bar className="pl-progress-fill" style={{ width: `${Math.max(progress, 28)}%` }} />
        </div>
        <p className="pl-progress-label">{message}</p>
      </div>

      <div data-pl-fade className="pl-init" aria-hidden>
        <div className="pl-init-track">
          <div className="pl-init-fill" />
        </div>
        <p className="pl-init-label">Initializing...</p>
      </div>
    </div>
  );

  const shellClass = [fullPage ? 'pl-page' : 'pl-inline', theme === 'light' ? 'pl-theme-light' : 'pl-theme-dark'].join(' ');
  return <div className={shellClass}>{body}</div>;
}
