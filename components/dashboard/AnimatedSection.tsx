import { ReactNode } from 'react';

interface AnimatedSectionProps {
  children: ReactNode;
  delay?: number;
}

/** Lightweight CSS fade-in — no framer-motion bundle cost. */
export default function AnimatedSection({ children, delay = 0 }: AnimatedSectionProps) {
  return (
    <div
      className="portal-section-in"
      style={{ animationDelay: `${Math.min(delay, 0.5)}s` }}
    >
      {children}
    </div>
  );
}
