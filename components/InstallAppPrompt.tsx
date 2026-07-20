'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { isIOSDevice, isMobileLikeViewport, isStandaloneDisplay } from '@/lib/pwa';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 14;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function InstallAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandaloneDisplay() || wasRecentlyDismissed()) return;
    if (!isMobileLikeViewport()) return;

    setIos(isIOSDevice());
    setVisible(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      role="region"
      aria-label="Install app"
    >
      <div className="mx-auto max-w-lg pointer-events-auto rounded-2xl border border-indigo-200/80 bg-white/95 backdrop-blur-md shadow-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Install IIChE AVVU app</p>
            {ios ? (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                On iPhone/iPad: tap{' '}
                <Share className="inline w-3.5 h-3.5 align-text-bottom mx-0.5" aria-hidden />
                <strong> Share</strong> in Safari, then choose{' '}
                <strong>Add to Home Screen</strong>. Works on iOS like a native app.
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Install for faster access, full-screen mode, and app-like experience on your phone.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 p-1 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {!ios && installEvent && (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Download className="w-4 h-4" />
            Install app
          </button>
        )}
      </div>
    </div>
  );
}
