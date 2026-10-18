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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const NAME_HEADER_RE = /^(name|student|full\s*name|participant|student\s*name)$/i;
const EMAIL_HEADER_RE = /^(email|e-?mail|mail|student\s*email)$/i;
const GROUP_HEADER_RE = /^(group|section|class|batch|year)$/i;

function splitRosterLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((p) => p.trim());
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  if (semis > commas) return line.split(';').map((p) => p.trim());
  return line.split(',').map((p) => p.trim());
}

function looksLikeRosterHeader(parts: string[]): boolean {
  const first = (parts[0] || '').replace(/^["']|["']$/g, '');
  return NAME_HEADER_RE.test(first) || EMAIL_HEADER_RE.test(first);
}

/** Parse bulk text: Name / Name,Email / Name,Email,Group, TSV from Excel, or a header row. */
export function parseBulkParticipantLines(
  text: string,
  defaultGroup = '',
): Array<{ name: string; email: string; group: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  let start = 0;
  let nameIdx = 0;
  let emailIdx = 1;
  let groupIdx = 2;
  const headerParts = splitRosterLine(lines[0]);
  if (looksLikeRosterHeader(headerParts)) {
    start = 1;
    nameIdx = headerParts.findIndex((p) => NAME_HEADER_RE.test(p));
    emailIdx = headerParts.findIndex((p) => EMAIL_HEADER_RE.test(p));
    groupIdx = headerParts.findIndex((p) => GROUP_HEADER_RE.test(p));
    if (nameIdx < 0) nameIdx = 0;
    if (emailIdx < 0) emailIdx = headerParts.findIndex((p) => EMAIL_RE.test(p)) >= 0 ? headerParts.findIndex((p) => EMAIL_RE.test(p)) : 1;
  }

  const rows: Array<{ name: string; email: string; group: string }> = [];
  for (const line of lines.slice(start)) {
    const parts = splitRosterLine(line).filter((p, i, arr) => p || i < arr.length - 1);
    if (!parts.length) continue;
    let name = (parts[nameIdx] || '').replace(/^["']|["']$/g, '');
    let email = (parts[emailIdx] || '').replace(/^["']|["']$/g, '');
    let group = (groupIdx >= 0 ? parts[groupIdx] : '') || defaultGroup;
    if (!EMAIL_RE.test(email)) {
      const found = parts.find((p) => EMAIL_RE.test(p));
      email = found || '';
    }
    if (!name || EMAIL_RE.test(name)) {
      name = parts.find((p) => p && !EMAIL_RE.test(p) && p !== group) || '';
    }
    if (!name) continue;
    if (NAME_HEADER_RE.test(name)) continue;
    rows.push({ name, email, group: (group || defaultGroup).trim() });
  }
  return rows;
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
