'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Bell, CalendarClock, FileText, Users } from 'lucide-react';
import DynamicLogo from '@/components/DynamicLogo';

gsap.registerPlugin(useGSAP);

export type LoaderVariant = 'home' | 'events' | 'community' | 'resources' | 'updates';

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
  /** Section-specific loader (matches brand mockups). */
  variant?: LoaderVariant;
}

const SECTION: Record<
  Exclude<LoaderVariant, 'home'>,
  { title: string; accent: string; status: string; Icon: typeof CalendarClock }
> = {
  events: {
    title: 'Events',
    accent: 'events',
    status: 'Fetching exciting events for you...',
    Icon: CalendarClock,
  },
  community: {
    title: 'Community',
    accent: 'community',
    status: 'Bringing the community together...',
    Icon: Users,
  },
  resources: {
    title: 'Resources',
    accent: 'resources',
    status: 'Collecting useful resources...',
    Icon: FileText,
  },
  updates: {
    title: 'Updates',
    accent: 'updates',
    status: 'Getting latest updates...',
    Icon: Bell,
  },
};

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

/** Brand loading screens — home + section variants, light/dark theme aware. */
export default function PortalLoadingScreen({
  message,
  fullPage = true,
  className = '',
  variant = 'home',
}: PortalLoadingScreenProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => readPortalTheme());
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    setTheme(readPortalTheme());
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
  }, [variant, message]);

  const section = variant === 'home' ? null : SECTION[variant];
  const SectionIcon = section?.Icon;
  const statusText = useMemo(() => {
    if (message) return message;
    if (section) return section.status;
    return 'Loading...';
  }, [message, section]);

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
    { scope: rootRef, dependencies: [variant, theme] },
  );

  const body = (
    <div
      ref={rootRef}
      className={`pl-root pl-variant-${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {section ? (
        <>
          <p data-pl-fade className={`pl-section-heading pl-accent-${section.accent}`}>
            Loading <span>{section.title}</span>
          </p>
          <div data-pl-fade className="pl-brand-row">
            <DynamicLogo width={42} height={42} className="pl-logo-img" />
            <div className="pl-brand-text">
              <p className="pl-brand-name">
                <span className="pl-brand-iiche">IIChE</span> <span className="pl-brand-avvu">AVVU SC</span>
              </p>
              <p className="pl-tagline">IGNITE · INNOVATE · INSPIRE</p>
            </div>
          </div>
          <div className="pl-section-orbiter" aria-hidden>
            <svg className="pl-section-ring-svg" viewBox="0 0 120 120" fill="none">
              <defs>
                <linearGradient id="pl-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="50%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#84cc16" />
                </linearGradient>
              </defs>
              <circle className="pl-section-track" cx="60" cy="60" r="52" />
              <circle
                data-pl-ring
                className="pl-section-arc"
                cx="60"
                cy="60"
                r="52"
                stroke="url(#pl-arc-grad)"
              />
            </svg>
            <div className="pl-section-icon">
              {SectionIcon ? <SectionIcon className="pl-section-lucide" strokeWidth={1.5} /> : null}
            </div>
          </div>
          <p data-pl-fade className="pl-status">
            {statusText}
          </p>
          <div data-pl-fade className="pl-progress-wrap">
            <div className="pl-progress-track">
              <div
                data-pl-bar
                className="pl-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="pl-progress-pct">{progress}%</p>
          </div>
        </>
      ) : (
        <>
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
              <div
                data-pl-bar
                className="pl-progress-fill"
                style={{ width: `${Math.max(progress, 28)}%` }}
              />
            </div>
            <p className="pl-progress-label">{statusText}</p>
          </div>

          <div data-pl-fade className="pl-init" aria-hidden>
            <div className="pl-init-track">
              <div className="pl-init-fill" />
            </div>
            <p className="pl-init-label">Initializing...</p>
          </div>
        </>
      )}
    </div>
  );

  const shellClass = [
    fullPage ? 'pl-page' : 'pl-inline',
    theme === 'light' ? 'pl-theme-light' : 'pl-theme-dark',
  ].join(' ');

  return <div className={shellClass}>{body}</div>;
}
