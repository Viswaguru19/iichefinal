import { describe, expect, it } from 'vitest';
import { isCoHeadPosition, isHeadPosition, normalizeCommitteePosition } from '@/lib/committee-positions';

describe('committee-positions', () => {
  it('treats common co-head spellings as co-head', () => {
    expect(isCoHeadPosition('co_head')).toBe(true);
    expect(isCoHeadPosition('co-head')).toBe(true);
    expect(isCoHeadPosition('Co-Head')).toBe(true);
    expect(isCoHeadPosition('cohead')).toBe(true);
    expect(isCoHeadPosition('Co Head')).toBe(true);
    expect(isCoHeadPosition('committee_cohead')).toBe(true);
  });

  it('does not treat heads or members as co-heads', () => {
    expect(isCoHeadPosition('head')).toBe(false);
    expect(isCoHeadPosition('committee_head')).toBe(false);
    expect(isCoHeadPosition('member')).toBe(false);
  });

  it('normalizes hyphens and spaces', () => {
    expect(normalizeCommitteePosition('Co-Head')).toBe('co_head');
    expect(isHeadPosition('Head')).toBe(true);
    expect(isHeadPosition('committee_head')).toBe(true);
  });
});
