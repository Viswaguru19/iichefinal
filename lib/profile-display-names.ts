export function profileDisplayName(row?: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
} | null): string {
  if (!row) return '';
  const name = String(row.name || '').trim();
  if (name) return name;
  const username = String(row.username || '').trim();
  if (username) return username;
  const email = String(row.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return email;
}

export async function mapProfileDisplayNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ids: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) return {};

  const { data: rpcData, error: rpcError } = await supabase.rpc('profile_display_names', { p_ids: unique });
  if (!rpcError && rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData)) {
    const mapped: Record<string, string> = {};
    for (const [id, value] of Object.entries(rpcData as Record<string, unknown>)) {
      const label = String(value || '').trim();
      if (label) mapped[id] = label;
    }
    if (Object.keys(mapped).length) return mapped;
  }

  const { data: people, error } = await supabase
    .from('profiles')
    .select('id, name, username, email')
    .in('id', unique);
  if (error) console.error('mapProfileDisplayNames', error);
  return Object.fromEntries(
    (people || []).map((p: { id: string; name?: string; username?: string; email?: string }) => [
      p.id,
      profileDisplayName(p),
    ]),
  );
}
