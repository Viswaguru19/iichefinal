'use client';

/**
 * Shared React Bits / GSAP atmosphere for dashboard pages.
 * CSS mesh only — keeps load light vs WebGL Aurora.
 */
import GradientMesh from '@/components/react-bits/GradientMesh';
import GsapText from '@/components/react-bits/GsapText';

interface DashboardAtmosphereProps {
  className?: string;
  /** Optional GSAP subtitle under the page header */
  subtitle?: string;
  subtitleClassName?: string;
  meshOpacity?: string;
}

export default function DashboardAtmosphere({
  className = '',
  subtitle,
  subtitleClassName = 'text-sm text-gray-500',
  meshOpacity = 'opacity-60',
}: DashboardAtmosphereProps) {
  return (
    <>
      <GradientMesh className={`${meshOpacity} ${className}`.trim()} />
      {subtitle ? (
        <div className="max-w-7xl mx-auto px-4 pt-4 relative z-10">
          <GsapText
            text={subtitle}
            as="p"
            className={subtitleClassName}
            split="words"
            delay={0.1}
            stagger={0.035}
          />
        </div>
      ) : null}
    </>
  );
}
