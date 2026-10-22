import type { SupabaseClient } from '@supabase/supabase-js';

const IMAGE_TYPES = /^image\//i;

export function imageFilesFromList(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter((file) => IMAGE_TYPES.test(file.type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name));
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
  const files = opts.files.filter(Boolean);
  const failed: string[] = [];
  const rows: Array<{ event_id: string; photo_url: string; uploaded_by: string; caption: string | null }> = [];
  const caption = opts.caption?.trim() || null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    opts.onProgress?.(i, files.length);
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^\w]+/g, '').slice(0, 8) || 'jpg';
    const path = `${opts.eventId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('event-photos').upload(path, file);
    if (upErr) {
      failed.push(file.name);
      continue;
    }
    rows.push({
      event_id: opts.eventId,
      photo_url: path,
      uploaded_by: opts.userId,
      caption,
    });
  }

  if (rows.length) {
    const { error } = await supabase.from('event_photos').insert(rows);
    if (error) {
      return { uploaded: 0, failed: files.map((f) => f.name) };
    }
  }

  opts.onProgress?.(files.length, files.length);
  return { uploaded: rows.length, failed };
}
