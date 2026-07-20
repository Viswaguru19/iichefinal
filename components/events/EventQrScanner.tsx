'use client';

import { useEffect, useId, useRef } from 'react';
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
  const readerId = useId().replace(/:/g, '');
  const onCloseRef = useRef(onClose);
  const onScannedRef = useRef(onScanned);

  onCloseRef.current = onClose;
  onScannedRef.current = onScanned;

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    let handled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        scanner = new Html5Qrcode(readerId);
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
  }, [open, readerId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
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
