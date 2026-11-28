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

export function isManualParticipantSource(source: string | null | undefined): boolean {
  return source === 'manual' || source === 'bulk_import';
}

export function registrationSourceLabel(source: string | null | undefined): string | null {
  if (!source || source === 'advance' || isManualParticipantSource(source)) return null;
  if (source === 'on_site') return 'On-site registration';
  return source.replace(/_/g, ' ');
}

const NAME_HEADER_RE = /^(name|student|full\s*name|participant|student\s*name)$/i;
const EMAIL_HEADER_RE = /^(email|e-?mail|mail|student\s*email)$/i;
const IDENTIFIER_HEADER_RE =
  /^(email|e-?mail|mail|student\s*email|roll(?:\s*(?:no\.?|number))?|reg(?:ister)?(?:\s*(?:no\.?|number))?|id|phone|mobile)$/i;
const GROUP_HEADER_RE = /^(group|section|class|batch|year)$/i;
const SERIAL_HEADER_RE =
  /^(s\.?\s*l\.?\s*no\.?|sl\.?\s*no\.?|s\/l|serial(?:\s*(?:no\.?|number))?|s\.?\s*no\.?|#)$/i;

function cleanRosterCell(value: string): string {
  return (value || '').replace(/^["']|["']$/g, '').trim();
}

function splitRosterLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((p) => p.trim());
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  if (semis > commas) return line.split(';').map((p) => p.trim());
  return line.split(',').map((p) => p.trim());
}

function headerIndexes(parts: string[]) {
  const cells = parts.map(cleanRosterCell);
  return {
    nameIdx: cells.findIndex((p) => NAME_HEADER_RE.test(p)),
    emailIdx: cells.findIndex((p) => IDENTIFIER_HEADER_RE.test(p) || EMAIL_HEADER_RE.test(p)),
    groupIdx: cells.findIndex((p) => GROUP_HEADER_RE.test(p)),
    serialIdx: cells.findIndex((p) => SERIAL_HEADER_RE.test(p)),
  };
}

function looksLikeRosterHeader(parts: string[]): boolean {
  const idx = headerIndexes(parts);
  return idx.nameIdx >= 0 || idx.emailIdx >= 0 || idx.groupIdx >= 0 || idx.serialIdx >= 0;
}

function looksLikeSerialValue(value: string): boolean {
  return /^\d{1,4}$/.test(value);
}

function inferNameAndIdIndexes(parts: string[]): { nameIdx: number; emailIdx: number; groupIdx: number } {
  const cells = parts.map(cleanRosterCell);
  if (cells.length >= 3 && looksLikeSerialValue(cells[0])) {
    const secondLooksId = /@/.test(cells[1]) || /\d/.test(cells[1]);
    const thirdLooksName = /[A-Za-z]{2,}/.test(cells[2]);
    if (secondLooksId && thirdLooksName) return { nameIdx: 2, emailIdx: 1, groupIdx: -1 };
  }
  return { nameIdx: 0, emailIdx: 1, groupIdx: 2 };
}

/** Second roster field (email, roll no, or any other id). Empty when the line is name-only. */
export function participantSecondaryText(value: string | null | undefined): string {
  return (value || '').trim();
}

export function looksLikeParticipantRoster(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  const data = lines.filter(
    (line) => !/^(add|import|enroll|please|attached)\b/i.test(line) && !/^attached .+:/i.test(line),
  );
  if (data.length < 2) return false;
  const withSecondField = data.filter((line) => {
    const parts = splitRosterLine(line).filter(Boolean);
    const second = parts[1] || '';
    const looksLikeId = /@/.test(second) || /\d/.test(second);
    return parts.length >= 2 && parts[0].length >= 2 && parts[0].length < 80 && looksLikeId;
  });
  return withSecondField.length >= 2 && withSecondField.length >= data.length * 0.5;
}

/** Unwrap ``` fences and split a pasted one-line Name,roll Name,roll dump into real lines. */
export function normalizeRosterText(text: string): string {
  let t = String(text || '').replace(/\r\n/g, '\n');
  t = t.replace(/```(?:text|csv|tsv|excel)?\s*/gi, '').replace(/```/g, '');
  const lineCount = t.split('\n').filter((line) => line.trim()).length;
  if (lineCount <= 2) {
    t = t.replace(/,([A-Za-z]{2}\.[A-Za-z]{2}\.[A-Za-z0-9.]+)\s+/g, ',$1\n');
  }
  return t.trim();
}

/** Parse bulk text: Name / Name,second / Name,second,Group. Second can be email, roll no, or any id. */
export function parseBulkParticipantLines(
  text: string,
  defaultGroup = '',
): Array<{ name: string; email: string; group: string }> {
  const lines = normalizeRosterText(text)
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && splitRosterLine(line).some((p) => cleanRosterCell(p)));
  if (!lines.length) return [];

  let start = 0;
  let nameIdx = 0;
  let emailIdx = 1;
  let groupIdx = 2;
  const headerParts = splitRosterLine(lines[0]);
  if (looksLikeRosterHeader(headerParts)) {
    start = 1;
    const idx = headerIndexes(headerParts);
    nameIdx = idx.nameIdx;
    emailIdx = idx.emailIdx;
    groupIdx = idx.groupIdx;
    if (nameIdx < 0) nameIdx = idx.serialIdx === 0 ? 1 : 0;
    if (emailIdx < 0) emailIdx = nameIdx === 0 ? 1 : 0;
    if (emailIdx === nameIdx) emailIdx = nameIdx === 0 ? 1 : 0;
  } else {
    const inferred = inferNameAndIdIndexes(splitRosterLine(lines[Math.min(1, lines.length - 1)]));
    nameIdx = inferred.nameIdx;
    emailIdx = inferred.emailIdx;
    groupIdx = inferred.groupIdx;
  }

  const rows: Array<{ name: string; email: string; group: string }> = [];
  for (const line of lines.slice(start)) {
    const parts = splitRosterLine(line).map(cleanRosterCell);
    while (parts.length && !parts[parts.length - 1]) parts.pop();
    if (!parts.length) continue;
    const name = (parts[nameIdx] || '').trim();
    const email = (parts[emailIdx] || '').trim();
    const group = ((groupIdx >= 0 ? parts[groupIdx] : '') || defaultGroup).trim();
    if (!name || looksLikeSerialValue(name)) continue;
    if (
      NAME_HEADER_RE.test(name) ||
      IDENTIFIER_HEADER_RE.test(name) ||
      GROUP_HEADER_RE.test(name) ||
      SERIAL_HEADER_RE.test(name)
    ) {
      continue;
    }
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

export const FORM_REGISTRATION_GROUP = 'Registered through form';
export const ON_SPOT_REGISTRATION_GROUP = 'On-spot registration';

const NON_SLOT_GROUPS = new Set([
  FORM_REGISTRATION_GROUP,
  ON_SPOT_REGISTRATION_GROUP,
  'Form registration',
  'Unassigned',
]);

export type EventSlotCount = { name: string; count: number };
export type EventParticipantCount = { total: number; slots: EventSlotCount[] };

export function isSlotGroupName(name: string | null | undefined): boolean {
  const trimmed = (name || '').trim();
  return Boolean(trimmed) && !NON_SLOT_GROUPS.has(trimmed);
}

/** Total headcount, plus one count per slot group (limited-choice session or other named group). */
export function summarizeEventParticipantCounts(
  rows: { event_id: string; participant_group?: string | null }[],
  groups: { event_id: string; name: string; sort_order?: number | null }[] = [],
): Record<string, EventParticipantCount> {
  const byEvent = new Map<string, { total: number; counts: Map<string, number>; order: Map<string, number> }>();
  const bucket = (eventId: string) => {
    let row = byEvent.get(eventId);
    if (!row) {
      row = { total: 0, counts: new Map(), order: new Map() };
      byEvent.set(eventId, row);
    }
    return row;
  };

  for (const group of groups) {
    const name = (group.name || '').trim();
    if (!isSlotGroupName(name)) continue;
    const row = bucket(group.event_id);
    if (!row.counts.has(name)) row.counts.set(name, 0);
    if (!row.order.has(name)) row.order.set(name, group.sort_order ?? row.order.size);
  }

  for (const participant of rows) {
    const row = bucket(participant.event_id);
    row.total += 1;
    const name = (participant.participant_group || '').trim();
    if (!isSlotGroupName(name)) continue;
    row.counts.set(name, (row.counts.get(name) || 0) + 1);
    if (!row.order.has(name)) row.order.set(name, row.order.size);
  }

  const result: Record<string, EventParticipantCount> = {};
  for (const [eventId, row] of byEvent) {
    result[eventId] = {
      total: row.total,
      slots: [...row.counts.entries()]
        .map(([name, count]) => ({ name, count, order: row.order.get(name) ?? 0 }))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map(({ name, count }) => ({ name, count })),
    };
  }
  return result;
}

export function attendanceReportStatus(status: string | null | undefined): 'Present' | 'Absent' {
  return status === 'present' ? 'Present' : 'Absent';
}

export function participantDisplayGroup(p: {
  participant_group?: string | null;
  registration_source?: string | null;
}): string {
  const named = (p.participant_group || '').trim();
  if (
    named
    && named !== FORM_REGISTRATION_GROUP
    && named !== ON_SPOT_REGISTRATION_GROUP
    && named !== 'Form registration'
  ) {
    return named;
  }
  if (p.registration_source === 'on_site') return ON_SPOT_REGISTRATION_GROUP;
  if (p.registration_source === 'advance') return FORM_REGISTRATION_GROUP;
  if (isManualParticipantSource(p.registration_source)) {
    return participantGroupLabel(p.participant_group);
  }
  if (!named) return FORM_REGISTRATION_GROUP;
  return participantGroupLabel(p.participant_group);
}

/** Slot filters match the chosen session. Form and on-spot filters match how they registered, even when a slot is also set. */
export function participantMatchesGroupFilter(
  p: { participant_group?: string | null; registration_source?: string | null },
  filter: string,
): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === FORM_REGISTRATION_GROUP) {
    return p.registration_source === 'advance' || participantDisplayGroup(p) === FORM_REGISTRATION_GROUP;
  }
  if (filter === ON_SPOT_REGISTRATION_GROUP) {
    return p.registration_source === 'on_site' || participantDisplayGroup(p) === ON_SPOT_REGISTRATION_GROUP;
  }
  return participantDisplayGroup(p) === filter;
}

export function attendanceReportGroupName(p: {
  participant_group?: string | null;
  registration_source?: string | null;
}): string {
  return participantDisplayGroup(p);
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export type AttendanceReportParticipant = {
  participant_name?: string | null;
  participant_email?: string | null;
  participant_group?: string | null;
  registration_source?: string | null;
  attendance_status?: string | null;
  attended_at_label?: string;
};

export function buildAttendanceReportCsv(
  participants: AttendanceReportParticipant[],
  groupOrder: string[],
  groupAsColumn: boolean,
): string {
  const prepared = participants.map((p) => ({
    ...p,
    participant_group: participantDisplayGroup(p),
    name: (p.participant_name || 'Participant').trim() || 'Participant',
    email: (p.participant_email || '').trim(),
    status: attendanceReportStatus(p.attendance_status),
    attended_at: p.attended_at_label || '',
  }));
  const grouped = groupParticipants(prepared, [
    ...groupOrder,
    FORM_REGISTRATION_GROUP,
    ON_SPOT_REGISTRATION_GROUP,
  ]);

  if (groupAsColumn) {
    const header = 'Serial,Name,Email,Group,Attendance,Marked At';
    let serial = 0;
    const body = grouped.flatMap(({ group, items }) =>
      items.map((r) => {
        serial += 1;
        return [serial, r.name, r.email, group, r.status, r.attended_at].map(csvCell).join(',');
      }),
    );
    return [header, ...body].join('\n');
  }

  const memberHeader = 'Serial,Name,Email,Attendance,Marked At';
  const lines: string[] = [];
  for (const { group, items } of grouped) {
    if (!items.length) continue;
    if (lines.length) lines.push('');
    lines.push(csvCell(group));
    lines.push(memberHeader);
    items.forEach((r, idx) => {
      lines.push([idx + 1, r.name, r.email, r.status, r.attended_at].map(csvCell).join(','));
    });
  }
  return lines.join('\n');
}
