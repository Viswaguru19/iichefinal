let audioCtx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/** Call from a user tap (open scanner) so later beeps are not blocked. */
export function unlockScanAudio() {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(
  ctx: AudioContext,
  { frequency, duration, type, delay, gain }: {
    frequency: number;
    duration: number;
    type: OscillatorType;
    delay: number;
    gain: number;
  },
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  amp.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
  amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + delay + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.02);
}

/** Short click / ping for a valid check-in. */
export function playScanOk() {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  tone(ctx, { frequency: 980, duration: 0.045, type: 'sine', delay: 0, gain: 0.12 });
  tone(ctx, { frequency: 1480, duration: 0.07, type: 'sine', delay: 0.04, gain: 0.1 });
}

/** Low buzz for a wrong / unknown QR. */
export function playScanBuzz() {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  tone(ctx, { frequency: 160, duration: 0.16, type: 'square', delay: 0, gain: 0.08 });
  tone(ctx, { frequency: 110, duration: 0.12, type: 'square', delay: 0.09, gain: 0.07 });
}
