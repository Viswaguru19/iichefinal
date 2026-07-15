export const DEFAULT_PARTICIPANT_GROUPS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Faculty',
  'Guest',
  'Other',
] as const;

export function participantGroupLabel(group: string | null | undefined): string {
  const trimmed = (group || '').trim();
  return trimmed || 'Unassigned';
}

export function registrationSourceLabel(source: string | null | undefined): string | null {
  if (!source || source === 'advance') return null;
  if (source === 'on_site') return 'On-site registration';
  if (source === 'manual') return 'Added manually';
  if (source === 'bulk_import') return 'Bulk import';
  return source.replace(/_/g, ' ');
}

/** Parse bulk text: Name,Email,Group — one participant per line. */
export function parseBulkParticipantLines(text: string): Array<{ name: string; email: string; group: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        name: parts[0] || '',
        email: parts[1] || '',
        group: parts[2] || '',
      };
    })
    .filter((row) => row.name.length > 0);
}

export function groupParticipants<T extends { participant_group?: string | null }>(
  participants: T[],
): { group: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const p of participants) {
    const key = participantGroupLabel(p.participant_group);
    const list = map.get(key) || [];
    list.push(p);
    map.set(key, list);
  }
  const order = [...DEFAULT_PARTICIPANT_GROUPS, 'Unassigned'];
  const keys = [...map.keys()].sort((a, b) => {
    const ai = order.indexOf(a as (typeof DEFAULT_PARTICIPANT_GROUPS)[number]);
    const bi = order.indexOf(b as (typeof DEFAULT_PARTICIPANT_GROUPS)[number]);
    const aRank = ai >= 0 ? ai : 999;
    const bRank = bi >= 0 ? bi : 999;
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
  });
  return keys.map((group) => ({ group, items: map.get(group) || [] }));
}
