/** DB may store co_head / co-head / Co-Head / cohead. */
export function normalizeCommitteePosition(pos: string | null | undefined): string {
  if (pos == null || !String(pos).trim()) return '';
  return String(pos).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function isCoHeadPosition(pos: string | null | undefined): boolean {
  const n = normalizeCommitteePosition(pos);
  return n === 'co_head' || n === 'cohead' || n === 'committee_cohead';
}

export function isHeadPosition(pos: string | null | undefined): boolean {
  const n = normalizeCommitteePosition(pos);
  return n === 'head' || n === 'committee_head';
}
