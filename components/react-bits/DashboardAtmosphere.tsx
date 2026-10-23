'use client';

/**
 * Shared React Bits / GSAP atmosphere for dashboard pages.
 * CSS mesh only — keeps load light vs WebGL Aurora.
 */
import GradientMesh from '@/components/react-bits/GradientMesh';

interface DashboardAtmosphereProps {
  className?: string;
  meshOpacity?: string;
}

export default function DashboardAtmosphere({
  className = '',
  meshOpacity = 'opacity-60',
}: DashboardAtmosphereProps) {
  return <GradientMesh className={`${meshOpacity} ${className}`.trim()} />;
}
