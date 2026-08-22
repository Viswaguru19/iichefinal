'use client';

/**
 * Lightweight animated gradient mesh (React Bits aesthetic, CSS-only — no WebGL).
 */
interface GradientMeshProps {
  className?: string;
  colors?: [string, string, string];
  /** Soft edge fade. Use dark for loaders / dark theme. */
  fade?: 'light' | 'dark' | 'none';
}

export default function GradientMesh({
  className = '',
  colors = ['rgba(13,148,136,0.45)', 'rgba(37,99,235,0.38)', 'rgba(6,182,212,0.32)'],
  fade = 'light',
}: GradientMeshProps) {
  const fadeClass =
    fade === 'none'
      ? ''
      : fade === 'dark'
        ? 'bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(6,9,12,0.75)_100%)]'
        : 'bg-[radial-gradient(ellipse_at_top,_transparent_40%,_rgba(255,255,255,0.45)_100%)]';

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="rb-gradient-orb rb-gradient-orb-a"
        style={{ background: `radial-gradient(circle at center, ${colors[0]}, transparent 70%)` }}
      />
      <div
        className="rb-gradient-orb rb-gradient-orb-b"
        style={{ background: `radial-gradient(circle at center, ${colors[1]}, transparent 70%)` }}
      />
      <div
        className="rb-gradient-orb rb-gradient-orb-c"
        style={{ background: `radial-gradient(circle at center, ${colors[2]}, transparent 70%)` }}
      />
      {fadeClass ? <div className={`absolute inset-0 ${fadeClass}`} /> : null}
    </div>
  );
}
