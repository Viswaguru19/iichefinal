'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const COLORS = ['#f59e0b', '#ef4444', '#6366f1', '#10b981', '#ec4899', '#fbbf24', '#38bdf8', '#a855f7'];

type Piece = {
  id: number;
  side: 'left' | 'right';
  color: string;
  delay: number;
  duration: number;
  x: number;
  y: number;
  rotate: number;
  width: number;
  height: number;
  radius: number;
};

function burstPieces(): Piece[] {
  const out: Piece[] = [];
  let id = 0;
  for (const side of ['left', 'right'] as const) {
    for (let n = 0; n < 48; n += 1) {
      const stream = n % 4 === 0;
      out.push({
        id: id += 1,
        side,
        color: COLORS[n % COLORS.length],
        delay: Math.random() * 0.2,
        duration: 1.8 + Math.random() * 1.4,
        x: 12 + Math.random() * 55,
        y: -(18 + Math.random() * 62),
        rotate: (side === 'left' ? 1 : -1) * (160 + Math.random() * 320),
        width: stream ? 4 + Math.random() * 2 : 8 + Math.random() * 8,
        height: stream ? 18 + Math.random() * 18 : 8 + Math.random() * 8,
        radius: stream ? 999 : n % 3 === 0 ? 999 : 2,
      });
    }
  }
  return out;
}

export default function PartyPoppers({
  durationMs = 3800,
  onDone,
}: {
  durationMs?: number;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const pieces = useMemo(() => burstPieces(), []);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVisible(false);
      onDoneRef.current?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden" aria-hidden data-ec-poppers="1">
      <style>{`
        @keyframes ec-pop-left {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translate3d(var(--dx), var(--dy), 0) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes ec-pop-right {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translate3d(calc(var(--dx) * -1), var(--dy), 0) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes ec-cannon {
          0% { transform: rotate(var(--tilt)) scale(0.7); }
          25% { transform: rotate(var(--tilt)) scale(1.2); }
          100% { transform: rotate(var(--tilt)) scale(1); }
        }
      `}</style>

      <div
        className="absolute left-1 top-[40%] h-20 w-12 origin-bottom-left rounded-t-2xl bg-gradient-to-br from-rose-500 to-amber-400 shadow-xl"
        style={{ ['--tilt' as string]: '-32deg', animation: 'ec-cannon 0.5s ease-out' }}
      />
      <div
        className="absolute right-1 top-[40%] h-20 w-12 origin-bottom-right rounded-t-2xl bg-gradient-to-bl from-indigo-500 to-fuchsia-400 shadow-xl"
        style={{ ['--tilt' as string]: '32deg', animation: 'ec-cannon 0.5s ease-out' }}
      />

      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-[46%]"
          style={{
            left: p.side === 'left' ? 36 : undefined,
            right: p.side === 'right' ? 36 : undefined,
            width: p.width,
            height: p.height,
            borderRadius: p.radius,
            background: p.color,
            ['--dx' as string]: `${p.x}vw`,
            ['--dy' as string]: `${p.y}vh`,
            ['--rot' as string]: `${p.rotate}deg`,
            animation: `${p.side === 'left' ? 'ec-pop-left' : 'ec-pop-right'} ${p.duration}s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
