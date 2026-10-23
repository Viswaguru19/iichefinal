export function eventPhotoSharePath(token: string) {
  return `/photos/${encodeURIComponent(token)}`;
}

export function eventPhotoShareUrl(token: string, origin?: string) {
  const path = eventPhotoSharePath(token);
  if (origin) return `${origin}${path}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return path;
}

function fileNameFromPath(path: string, index: number) {
  const base = path.split('/').pop() || `photo-${index + 1}.jpg`;
  return base.replace(/[^\w.\-]+/g, '_') || `photo-${index + 1}.jpg`;
}

export async function downloadEventPhoto(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export async function downloadEventPhotos(
  photos: Array<{ url: string; path?: string | null }>,
  onProgress?: (done: number, total: number) => void,
) {
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    onProgress?.(i, photos.length);
    await downloadEventPhoto(photo.url, fileNameFromPath(photo.path || '', i));
    if (i < photos.length - 1) {
      await new Promise((r) => setTimeout(r, 280));
    }
  }
  onProgress?.(photos.length, photos.length);
}
