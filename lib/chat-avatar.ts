/** Turn a stored profile/group photo path into a URL the browser can load. */
export function chatPublicImageUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  raw?: string | null,
  bucket = 'avatars',
): string | null {
  const path = String(raw || '').trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}
