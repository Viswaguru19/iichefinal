'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import GradientText from '@/components/react-bits/GradientText';
import GradientMesh from '@/components/react-bits/GradientMesh';

gsap.registerPlugin(useGSAP);

interface PortalLoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

const LETTERS = ['I', 'I', 'C', 'h', 'E'] as const;

/** Full-bleed cinematic loader — mesh + GSAP letter reveal (no frosted card). */
export default function PortalLoadingScreen({
  message = 'Loading portal…',
  fullPage = true,
  className = '',
}: PortalLoadingScreenProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const letters = root.querySelectorAll<HTMLElement>('[data-loader-letter]');
      const meta = root.querySelectorAll<HTMLElement>('[data-loader-meta]');
      const rings = root.querySelectorAll<HTMLElement>('[data-loader-ring]');
      const bead = root.querySelector<HTMLElement>('[data-loader-bead]');

      gsap.set(letters, { opacity: 0, y: 36, scale: 0.8, filter: 'blur(10px)' });
      gsap.set(meta, { opacity: 0, y: 18 });

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.to(letters, {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.65,
        stagger: 0.1,
        clearProps: 'filter',
      }).to(
        meta,
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
        },
        '-=0.25',
      );

      gsap.to(letters, {
        y: -4,
        duration: 1.35,
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.14, from: 'center' },
        ease: 'sine.inOut',
        delay: 0.9,
      });

      if (rings.length) {
        gsap.to(rings[0], { rotation: 360, duration: 2.6, ease: 'none', repeat: -1 });
        gsap.to(rings[1], { rotation: -360, duration: 4, ease: 'none', repeat: -1 });
      }
      if (bead) {
        gsap.to(bead, { rotation: 360, duration: 2.6, ease: 'none', repeat: -1 });
      }
    },
    { scope: rootRef, dependencies: [message] },
  );

  const card = (
    <div
      ref={rootRef}
      className={`portal-loader-stage ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="portal-loader-orbit" aria-hidden>
        <span data-loader-ring className="portal-loader-orbit-ring portal-loader-orbit-ring-a" />
        <span data-loader-ring className="portal-loader-orbit-ring portal-loader-orbit-ring-b" />
        <span data-loader-bead className="portal-loader-orbit-bead" />
      </div>

      <div className="portal-loader-core">
        <div className="portal-loader-iiche" aria-label="IIChE">
          {LETTERS.map((letter, i) => (
            <span key={`${letter}-${i}`} data-loader-letter className="portal-loader-letter">
              {letter}
            </span>
          ))}
        </div>
      </div>

      <div className="portal-loader-meta">
        <div data-loader-meta>
          <GradientText
            className="portal-loader-brand-text text-sm sm:text-base font-extrabold tracking-[0.32em] uppercase"
            colors={['#5eead4', '#22d3ee', '#38bdf8', '#a5b4fc', '#5eead4']}
            animationSpeed={4}
          >
            AVVU SC
          </GradientText>
        </div>
        <p data-loader-meta className="portal-loader-tagline">
          Student Chapter Portal
        </p>
        <p data-loader-meta className="portal-loader-message">
          {message}
        </p>
        <div data-loader-meta className="portal-loader-track" aria-hidden>
          <span className="portal-loader-track-fill" />
        </div>
      </div>
    </div>
  );

  if (!fullPage) {
    return <div className="portal-loader-inline">{card}</div>;
  }

  return (
    <div className="portal-loader-page portal-fade-in">
      <GradientMesh
        className="opacity-100"
        fade="dark"
        colors={['rgba(45,212,191,0.55)', 'rgba(56,189,248,0.42)', 'rgba(99,102,241,0.35)']}
      />
      <div className="portal-loader-bg-orb portal-loader-bg-orb-1" aria-hidden />
      <div className="portal-loader-bg-orb portal-loader-bg-orb-2" aria-hidden />
      <div className="portal-loader-bg-grid" aria-hidden />
      {card}
    </div>
  );
}
