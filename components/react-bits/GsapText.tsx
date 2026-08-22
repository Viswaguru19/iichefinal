'use client';

/**
 * Free GSAP text reveal (React Bits–style stagger without Club GSAP SplitText).
 */
import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface GsapTextProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  delay?: number;
  stagger?: number;
  duration?: number;
  split?: 'chars' | 'words';
}

export default function GsapText({
  text,
  className = '',
  as: Tag = 'h2',
  delay = 0,
  stagger = 0.03,
  duration = 0.55,
  split = 'words',
}: GsapTextProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const el = rootRef.current;
      if (!el) return;
      const units = el.querySelectorAll<HTMLElement>('[data-gsap-unit]');
      if (!units.length) return;
      gsap.fromTo(
        units,
        { opacity: 0, y: 18, filter: 'blur(4px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration,
          delay,
          stagger,
          ease: 'power3.out',
          clearProps: 'filter',
        },
      );
    },
    { dependencies: [text, delay, stagger, duration, split], scope: rootRef },
  );

  const parts =
    split === 'chars'
      ? Array.from(text)
      : text.split(/(\s+)/).filter((p) => p.length > 0);

  return (
    <Tag ref={rootRef as never} className={className} aria-label={text}>
      {parts.map((part, i) =>
        part.trim() === '' ? (
          <span key={`s-${i}`}>{part}</span>
        ) : (
          <span
            key={`${part}-${i}`}
            data-gsap-unit
            className="inline-block will-change-transform"
            style={{ whiteSpace: split === 'chars' && part === ' ' ? 'pre' : undefined }}
          >
            {part === ' ' ? '\u00A0' : part}
            {split === 'words' && !/\s/.test(part) ? '\u00A0' : null}
          </span>
        ),
      )}
    </Tag>
  );
}
