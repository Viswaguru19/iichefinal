'use client';

import { useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

interface EventQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned: (decodedText: string) => void;
}

export default function EventQrScanner({ open, onClose, onScanned }: EventQrScannerProps) {
  const readerId = useMemo(
    () => `event-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  useEffect(() => {
    if (!open) return;
    let scanner: any = null;
    let mounted = true;
    let handled = false;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;
        scanner = new Html5Qrcode(readerId);
        const config = { fps: 10, qrbox: { width: 260, height: 260 } };
        const onSuccess = (decodedText: string) => {
          if (handled) return;
          handled = true;
          try {
            onScanned(decodedText);
          } catch (err) {
            console.error('QR scan callback failed:', err);
            toast.error('Scanned, but failed to process QR payload');
          }
          void scanner?.stop().catch(() => {});
          onClose();
        };
        const onError = () => {};

        // Prefer back camera; fallback to first available if unsupported.
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
        onClose();
      }
    };

    void start();
    return () => {
      mounted = false;
      if (scanner) {
        void scanner.stop().catch(() => {});
        void scanner.clear?.().catch?.(() => {});
      }
    };
  }, [open, onClose, onScanned, readerId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Scan Participant QR</h4>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">Close</button>
        </div>
        <div id={readerId} className="w-full overflow-hidden rounded-xl border border-gray-200" />
        <p className="text-xs text-gray-500 mt-2">Point camera at participant QR code.</p>
      </div>
    </div>
  );
}

