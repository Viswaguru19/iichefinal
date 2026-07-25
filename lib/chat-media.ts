/** Helpers for chat attachments (images, audio, docs). */

export function isImageUrl(url: string | null | undefined, message?: string | null): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)) return true;
  if (message && /^🖼|^📷|image\//i.test(message)) return true;
  return false;
}

export function isAudioUrl(url: string | null | undefined, message?: string | null): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  if (/\.(webm|ogg|mp3|m4a|wav|aac)$/i.test(path)) return true;
  if (message && (message.includes('🎤') || /voice|audio/i.test(message))) return true;
  return false;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(webm|ogg|mp3|m4a|wav)$/i.test(file.name);
}

export function attachmentLabel(file: File): string {
  if (isImageFile(file)) return `🖼 ${file.name}`;
  if (isAudioFile(file)) return `🎤 Voice message`;
  return `📎 ${file.name}`;
}
