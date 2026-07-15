export interface EventParticipantGroup {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
  created_at?: string;
}

export const NO_GROUP_VALUE = '';

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

/** Parse bulk text: Name,Email or Name,Email,Group — one participant per line. */
export function parseBulkParticipantLines(
  text: string,
  defaultGroup = '',
): Array<{ name: string; email: string; group: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        name: parts[0] || '',
        email: parts[1] || '',
        group: parts[2] || defaultGroup,
      };
    })
    .filter((row) => row.name.length > 0);
}

export function groupParticipants<T extends { participant_group?: string | null }>(
  participants: T[],
  groupOrder: string[] = [],
): { group: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const p of participants) {
    const key = participantGroupLabel(p.participant_group);
    const list = map.get(key) || [];
    list.push(p);
    map.set(key, list);
  }

  const orderedNames = [
    ...groupOrder.map((g) => g.trim()).filter(Boolean),
    ...[...map.keys()].filter((k) => k !== 'Unassigned' && !groupOrder.includes(k)),
  ];
  const keys = [...new Set([...orderedNames, ...(map.has('Unassigned') ? ['Unassigned'] : [])])];

  return keys.map((group) => ({ group, items: map.get(group) || [] }));
}
