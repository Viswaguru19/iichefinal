import crypto from 'crypto';

const DEFAULT_VAPID_SUBJECT = 'mailto:admin@iicheavvu.in';

/** Normalize common VAPID_SUBJECT mistakes (missing mailto:, quotes, spaces). */
export function resolveVapidSubject(raw?: string | null): string {
  let subject = (raw || DEFAULT_VAPID_SUBJECT).trim().replace(/^["']|["']$/g, '');
  if (!subject) return DEFAULT_VAPID_SUBJECT;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)) {
    subject = `mailto:${subject}`;
  }
  return subject;
}

export function isValidVapidSubject(subject: string): boolean {
  try {
    const url = new URL(subject);
    return url.protocol === 'mailto:' || url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function urlBase64ToBuffer(base64String: string): Buffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

/** True when public + private VAPID keys belong to the same EC key pair. */
export function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  try {
    const publicBuf = urlBase64ToBuffer(publicKey);
    const privateBuf = urlBase64ToBuffer(privateKey);
    if (privateBuf.length !== 32 || publicBuf.length !== 65) return false;

    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(privateBuf);
    const derived = ecdh.getPublicKey(undefined, 'uncompressed');
    return derived.equals(publicBuf);
  } catch {
    return false;
  }
}
