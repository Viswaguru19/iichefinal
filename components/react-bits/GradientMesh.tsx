'use client';

/**
 * Lightweight animated gradient mesh (React Bits gradient aesthetic, CSS-only — no WebGL).
 * Safer for portal performance than Aurora / GradientBlinds.
 */
interface GradientMeshProps {
  className?: string;
  colors?: [string, string, string];
}

export default function GradientMesh({
  className = '',
  colors = ['rgba(13,148,136,0.35)', 'rgba(37,99,235,0.28)', 'rgba(6,182,212,0.22)'],
}: GradientMeshProps) {
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_40%,_rgba(255,255,255,0.55)_100%)]" />
    </div>
  );
}
