'use client';

import { useEffect } from 'react';

interface EventQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned: (decodedText: string) => void;
}

export default function EventQrScanner({ open, onClose, onScanned }: EventQrScannerProps) {
  useEffect(() => {
    if (!open) return;
    let scanner: any = null;
    let mounted = true;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;
        scanner = new Html5Qrcode('event-qr-reader');
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            onScanned(decodedText);
            void scanner?.stop().catch(() => {});
            onClose();
          },
          () => {}
        );
      } catch {
        onClose();
      }
    };

    void start();
    return () => {
      mounted = false;
      if (scanner) {
        void scanner.stop().catch(() => {});
      }
    };
  }, [open, onClose, onScanned]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Scan Participant QR</h4>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">Close</button>
        </div>
        <div id="event-qr-reader" className="w-full overflow-hidden rounded-xl border border-gray-200" />
        <p className="text-xs text-gray-500 mt-2">Point camera at participant QR code.</p>
      </div>
    </div>
  );
}

