import type { SupabaseClient } from '@supabase/supabase-js';

const IMAGE_TYPES = /^image\//i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i;

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.test(file.type) || IMAGE_EXT.test(file.name);
}

export function imageFilesFromList(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter(isImageFile);
}

function cloneFile(file: File): File {
  try {
    return new File([file], file.name, { type: file.type || 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

function fileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function collectFromEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await fileFromEntry(entry as FileSystemFileEntry);
    if (isImageFile(file)) out.push(cloneFile(file));
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await readDirectoryEntries(reader);
    if (!batch.length) break;
    for (const child of batch) await collectFromEntry(child, out);
  }
}

/** All image files from a Finder/Explorer drop, including folders. */
export async function imageFilesFromDataTransfer(dt: DataTransfer | null | undefined): Promise<File[]> {
  if (!dt) return [];
  const items = dt.items;
  if (items && items.length) {
    const collected: File[] = [];
    const walks: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (entry) {
        walks.push(collectFromEntry(entry, collected));
        continue;
      }
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && isImageFile(file)) collected.push(cloneFile(file));
      }
    }
    if (walks.length) await Promise.all(walks);
    if (collected.length) return collected;
  }
  return imageFilesFromList(dt.files).map(cloneFile);
}

export async function uploadEventPhotoFiles(
  supabase: SupabaseClient,
  opts: {
    eventId: string;
    userId: string;
    files: File[];
    caption?: string | null;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<{ uploaded: number; failed: string[] }> {
  const files = opts.files.filter(Boolean).map(cloneFile);
  const failed: string[] = [];
  let uploaded = 0;
  const caption = opts.caption?.trim() || null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    opts.onProgress?.(i, files.length);
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^\w]+/g, '').slice(0, 8) || 'jpg';
    const path = `${opts.eventId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('event-photos').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (upErr) {
      failed.push(file.name);
      continue;
    }
    const { error } = await supabase.from('event_photos').insert({
      event_id: opts.eventId,
      photo_url: path,
      uploaded_by: opts.userId,
      caption,
    });
    if (error) {
      failed.push(file.name);
      continue;
    }
    uploaded += 1;
  }

  opts.onProgress?.(files.length, files.length);
  return { uploaded, failed };
}
