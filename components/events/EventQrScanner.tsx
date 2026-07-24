'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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

const SCAN_COOLDOWN_MS = 2000;

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
  const busyRef = useRef(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastResult, setLastResult] = useState<QrScanResult | null>(null);
  const [processing, setProcessing] = useState(false);

  onCloseRef.current = onClose;
  onScannedRef.current = onScanned;

  useEffect(() => {
    if (!open) {
      setScanCount(0);
      setLastResult(null);
      setProcessing(false);
      lastPayloadRef.current = '';
      lastScanAtRef.current = 0;
      busyRef.current = false;
      return;
    }

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
          if (busyRef.current) return;
          if (
            decodedText === lastPayloadRef.current &&
            now - lastScanAtRef.current < SCAN_COOLDOWN_MS
          ) {
            return;
          }

          lastPayloadRef.current = decodedText;
          lastScanAtRef.current = now;
          busyRef.current = true;
          setProcessing(true);

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
              setLastResult(feedback);
              setScanCount((c) => c + 1);
              if (!feedback.ok) {
                toast.error(feedback.message, { duration: 2500 });
              }
            } catch (err) {
              console.error('QR scan callback failed:', err);
              const msg = 'Failed to process QR';
              setLastResult({ ok: false, message: msg });
              toast.error(msg, { duration: 2500 });
            } finally {
              busyRef.current = false;
              if (mounted) setProcessing(false);
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
  }, [open, readerId, continuous]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-4 pb-6 sm:pb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Scan check-in QR</h4>
            <p className="text-[11px] text-gray-500">Continuous mode — keep scanning without closing</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold shrink-0"
          >
            Done
          </button>
        </div>

        <div id={readerId} className="w-full overflow-hidden rounded-xl border border-gray-200 bg-black min-h-[240px]" />

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{scanCount} scanned this session</span>
            {processing && <span className="text-indigo-600 font-semibold animate-pulse">Processing…</span>}
          </div>

          {lastResult && (
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
            Point at each participant&apos;s check-in QR. Same code won&apos;t fire again for 2 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
