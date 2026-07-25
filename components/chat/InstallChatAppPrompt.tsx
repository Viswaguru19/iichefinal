'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { isIOSDevice, isMobileLikeViewport, isStandaloneDisplay } from '@/lib/pwa';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'chat-pwa-install-dismissed';
const DISMISS_DAYS = 21;

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

/** Install prompt for IIChE Chat only (separate from the IIChE portal app). */
export default function InstallChatAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const alone = isStandaloneDisplay();
    setStandalone(alone);
    setIos(isIOSDevice());

    if (alone || wasRecentlyDismissed()) return;
    if (!isMobileLikeViewport() && !isIOSDevice()) return;

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

  if (standalone || !visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      role="region"
      aria-label="Install IIChE Chat"
    >
      <div className="mx-auto max-w-lg pointer-events-auto rounded-2xl border border-emerald-700/40 bg-[#1f2c34] shadow-2xl p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white/95 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/api/pwa/chat-icon" alt="" className="w-10 h-10 rounded-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Install IIChE Chat</p>
              {ios ? (
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  Tap <Share className="inline w-3.5 h-3.5 align-text-bottom mx-0.5" aria-hidden />{' '}
                  <strong>Share</strong> → <strong>Add to Home Screen</strong>. Opens chat only — separate from the IIChE portal app.
                </p>
              ) : (
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  Install from this Chat screen. It opens straight to messaging with its own icon, separate from IIChE.
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                If your phone says already installed, remove the old IIChE shortcut once, then install both apps again.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 p-1 rounded-md text-gray-400 hover:bg-white/10"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {!ios && installEvent && (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00a884] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#008f72]"
          >
            <Download className="w-4 h-4" />
            Install IIChE Chat
          </button>
        )}
      </div>
    </div>
  );
}
