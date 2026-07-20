'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

interface EventQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned: (decodedText: string) => void | Promise<void>;
}

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

export default function EventQrScanner({ open, onClose, onScanned }: EventQrScannerProps) {
  const readerId = useMemo(
    () => `event-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
  const onCloseRef = useRef(onClose);
  const onScannedRef = useRef(onScanned);
  const scannerRef = useRef<{ stop?: () => unknown; clear?: () => void } | null>(null);
  const [sessionActive, setSessionActive] = useState(false);

  onCloseRef.current = onClose;
  onScannedRef.current = onScanned;

  useEffect(() => {
    if (open) setSessionActive(true);
  }, [open]);

  useEffect(() => {
    if (!sessionActive) return;

    let mounted = true;
    let handled = false;

    const start = async () => {
      if (!open) return;
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !open) return;

        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;
        const config = { fps: 10, qrbox: { width: 260, height: 260 } };

        const onSuccess = (decodedText: string) => {
          if (handled) return;
          handled = true;
          onCloseRef.current();
          void (async () => {
            try {
              await onScannedRef.current(decodedText);
            } catch (err) {
              console.error('QR scan callback failed:', err);
              toast.error('Scanned, but failed to process QR payload');
            }
          })();
        };
        const onError = () => {};

        try {
          await scanner.start({ facingMode: { exact: 'environment' } }, config, onSuccess, onError);
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (!mounted || !open) return;
          if (!cameras || cameras.length === 0) throw new Error('No camera found');
          await scanner.start(cameras[0].id, config, onSuccess, onError);
        }
      } catch (err) {
        console.error('Failed to start QR scanner:', err);
        toast.error('Unable to open camera for QR scanning');
        onCloseRef.current();
      }
    };

    if (open) void start();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      void safelyStopScanner(scanner).finally(() => {
        if (!open) setSessionActive(false);
      });
    };
  }, [sessionActive, open, readerId]);

  if (!sessionActive) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 ${open ? '' : 'invisible pointer-events-none'}`}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Scan Participant QR</h4>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Close
          </button>
        </div>
        <div id={readerId} className="w-full overflow-hidden rounded-xl border border-gray-200" />
        <p className="text-xs text-gray-500 mt-2">Point camera at participant QR code.</p>
      </div>
    </div>
  );
}
