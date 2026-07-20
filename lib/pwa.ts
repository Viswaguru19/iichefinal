export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function isMobileLikeViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || isIOSDevice();
}

export function supportsWebPush(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** iOS 16.4+ supports Web Push only for installed PWAs (Add to Home Screen). */
export function canUseIosWebPush(): boolean {
  return isIOSDevice() && isStandaloneDisplay() && supportsWebPush();
}
