'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { playScanBuzz, playScanOk, unlockScanAudio } from '@/lib/scan-feedback-audio';

export type QrScanResult = {
  ok: boolean;
  message: string;
};

interface EventQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned: (decodedText: string) => void | Promise<QrScanResult | void>;
  /** Keep camera open after each scan (default: true). */
  continuous?: boolean;
}

/** Same code only — different people can be scanned back-to-back. */
const SAME_CODE_COOLDOWN_MS = 900;
const FLASH_MS = 420;

async function safelyStopScanner(scanner: { stop?: () => unknown; clear?: () => void } | null) {
  if (!scanner) return;
  try {
    const result = scanner.stop?.();
    if (result != null && typeof (result as Promise<unknown>).then === 'function') {
      await (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // html5-qrcode throws synchronously if already stopped
  }
  try {
    scanner.clear?.();
  } catch {
    // clear() throws if scanning is still active
  }
}

export default function EventQrScanner({
  open,
  onClose,
  onScanned,
  continuous = true,
}: EventQrScannerProps) {
  const readerId = useId().replace(/:/g, '');
  const onCloseRef = useRef(onClose);
  const onScannedRef = useRef(onScanned);
  const lastPayloadRef = useRef('');
  const lastScanAtRef = useRef(0);
  const inflightRef = useRef(new Set<string>());
  const flashTimerRef = useRef<number | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [lastResult, setLastResult] = useState<QrScanResult | null>(null);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);

  onCloseRef.current = onClose;
  onScannedRef.current = onScanned;

  function showFlash(kind: 'ok' | 'bad', feedback: QrScanResult) {
    if (kind === 'ok') playScanOk();
    else playScanBuzz();
    setFlash(kind);
    setLastResult(feedback);
    if (kind === 'ok') setScanCount((c) => c + 1);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }

  useEffect(() => {
    if (!open) {
      setScanCount(0);
      setLastResult(null);
      setFlash(null);
      lastPayloadRef.current = '';
      lastScanAtRef.current = 0;
      inflightRef.current.clear();
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      return;
    }
    unlockScanAudio();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        scanner = new Html5Qrcode(readerId);
        const config = {
          fps: 24,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const edge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(200, Math.floor(edge * 0.72));
            return { width: size, height: size };
          },
          aspectRatio: 1,
          disableFlip: false,
        };

        const onSuccess = (decodedText: string) => {
          const now = Date.now();
          if (inflightRef.current.has(decodedText)) return;
          if (
            decodedText === lastPayloadRef.current &&
            now - lastScanAtRef.current < SAME_CODE_COOLDOWN_MS
          ) {
            return;
          }

          lastPayloadRef.current = decodedText;
          lastScanAtRef.current = now;
          inflightRef.current.add(decodedText);

          if (!continuous) {
            void safelyStopScanner(scanner);
          }

          void (async () => {
            try {
              const result = await onScannedRef.current(decodedText);
              if (!mounted) return;
              const feedback: QrScanResult = result || {
                ok: true,
                message: 'Scan processed',
              };
              showFlash(feedback.ok ? 'ok' : 'bad', feedback);
            } catch (err) {
              console.error('QR scan callback failed:', err);
              if (!mounted) return;
              showFlash('bad', { ok: false, message: 'Failed to process QR' });
            } finally {
              inflightRef.current.delete(decodedText);
              if (!continuous) onCloseRef.current();
            }
          })();
        };
        const onError = () => {};

        try {
          await scanner.start({ facingMode: { exact: 'environment' } }, config, onSuccess, onError);
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (!mounted) return;
          if (!cameras || cameras.length === 0) throw new Error('No camera found');
          await scanner.start(cameras[0].id, config, onSuccess, onError);
        }
      } catch (err) {
        console.error('Failed to start QR scanner:', err);
        toast.error('Unable to open camera for QR scanning');
        onCloseRef.current();
      }
    };

    void start();

    return () => {
      mounted = false;
      void safelyStopScanner(scanner);
    };
    // showFlash is stable enough for this mount cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, readerId, continuous]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-4 pb-6 sm:pb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Scan check-in QR</h4>
            <p className="text-[11px] text-gray-500">Camera stays open — scan, then the next person</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold shrink-0"
          >
            Done
          </button>
        </div>

        <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-black min-h-[240px]">
          <div id={readerId} className="w-full min-h-[240px]" />
          {flash && (
            <div
              className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 ${
                flash === 'ok' ? 'bg-emerald-500/55 scan-flash-ok' : 'bg-rose-600/60 scan-flash-bad'
              }`}
            >
              {flash === 'ok' ? (
                <CheckCircle2 className="w-16 h-16 text-white drop-shadow-lg" strokeWidth={2.4} />
              ) : (
                <XCircle className="w-16 h-16 text-white drop-shadow-lg" strokeWidth={2.4} />
              )}
              <p className="text-white text-sm font-bold px-4 text-center drop-shadow">
                {lastResult?.message || (flash === 'ok' ? 'Present' : 'Wrong QR')}
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-600">{scanCount} checked in this session</p>
          {lastResult && !flash && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                lastResult.ok
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {lastResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{lastResult.message}</span>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Green click = present. Buzz = wrong QR. Point at the next code as soon as you hear it.
          </p>
        </div>
      </div>
    </div>
  );
}
