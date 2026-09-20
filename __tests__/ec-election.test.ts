import { describe, expect, it } from 'vitest';
import {
  ballotContestants,
  canContestEcElection,
  canManageEcElection,
  canRemoveEcNomination,
  canViewLiveElectionTally,
  canVoteEcElection,
  electionCardCopy,
  formatElectionCountdown,
  formatExecutiveRole,
  rankContestants,
  resolveElectionAvatarUrl,
  winnersForCategory,
} from '@/lib/ec-election';

describe('ec-election access', () => {
  it('lets faculty, admin, and social & environmental members manage', () => {
    expect(canManageEcElection({ is_faculty: true }, [])).toBe(true);
    expect(canManageEcElection({ is_admin: true }, [])).toBe(true);
    expect(
      canManageEcElection({ role: 'student' }, [{ name: 'Social and Environmental Committee' }]),
    ).toBe(true);
    expect(canManageEcElection({ role: 'student' }, [{ name: 'Program Committee' }])).toBe(false);
  });

  it('lets only admins see live tallies', () => {
    expect(canViewLiveElectionTally({ is_admin: true })).toBe(true);
    expect(canViewLiveElectionTally({ is_faculty: true })).toBe(false);
    expect(canViewLiveElectionTally({ role: 'secretary' })).toBe(false);
  });

  it('lets faculty and admins remove nominations, not committee managers', () => {
    expect(canRemoveEcNomination({ is_faculty: true })).toBe(true);
    expect(canRemoveEcNomination({ role: 'faculty_advisor' })).toBe(true);
    expect(canRemoveEcNomination({ is_admin: true })).toBe(true);
    expect(
      canRemoveEcNomination({ role: 'student' }),
    ).toBe(false);
  });

  it('lets heads contest Secretary and co-heads contest Joint Secretary and Treasurer', () => {
    expect(canContestEcElection([{ position: 'head' }], 'secretary')).toBe(true);
    expect(canContestEcElection([{ position: 'co_head' }], 'secretary')).toBe(false);
    expect(canContestEcElection([{ position: 'co_head' }], 'joint_secretary')).toBe(true);
    expect(canContestEcElection([{ position: 'head' }], 'joint_secretary')).toBe(false);
    expect(canContestEcElection([{ position: 'co_head' }], 'treasurer')).toBe(true);
    expect(canContestEcElection([{ position: 'head' }], 'treasurer')).toBe(false);
    expect(canVoteEcElection([{ position: 'co_head' }])).toBe(true);
    expect(canVoteEcElection([{ position: 'member' }])).toBe(false);
  });
});

describe('ec-election ranking', () => {
  it('picks highest and second-highest votes with earlier contest as tie-break', () => {
    const ranked = rankContestants([
      { id: 'b', name: 'B', votes: 4, createdAt: '2026-01-02' },
      { id: 'a', name: 'A', votes: 5, createdAt: '2026-01-03' },
      { id: 'c', name: 'C', votes: 4, createdAt: '2026-01-01' },
    ]);
    const winners = winnersForCategory(ranked);
    expect(winners.first?.id).toBe('a');
    expect(winners.second?.id).toBe('c');
  });
});

describe('ec-election role labels', () => {
  it('titles executive posts', () => {
    expect(formatExecutiveRole('associate_joint_secretary')).toBe('Associate Joint Secretary');
  });
});

describe('ec-election ballot cap', () => {
  it('keeps only the first two nominations per post', () => {
    const picked = ballotContestants([
      { id: 'c', created_at: '2026-01-03' },
      { id: 'a', created_at: '2026-01-01' },
      { id: 'b', created_at: '2026-01-02' },
    ]);
    expect(picked.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('uses on_ballot when the server already marked the slate', () => {
    const picked = ballotContestants([
      { id: 'a', created_at: '2026-01-01', on_ballot: true },
      { id: 'b', created_at: '2026-01-02', on_ballot: false },
      { id: 'c', created_at: '2026-01-03', on_ballot: true },
    ]);
    expect(picked.map((row) => row.id)).toEqual(['a', 'c']);
  });
});

describe('ec-election avatars and duration', () => {
  it('turns stored profile paths into public avatar urls', () => {
    expect(resolveElectionAvatarUrl('https://cdn.example/a.jpg', () => 'nope')).toBe('https://cdn.example/a.jpg');
    expect(resolveElectionAvatarUrl('me.png', (path) => `https://storage/${path}`)).toBe('https://storage/me.png');
    expect(resolveElectionAvatarUrl(null, () => 'nope')).toBeNull();
  });

  it('formats remaining voting time', () => {
    const now = Date.parse('2026-01-01T10:00:00.000Z');
    expect(formatElectionCountdown('2026-01-01T11:05:07.000Z', now)).toBe('1h 5m 7s');
    expect(formatElectionCountdown('2026-01-01T09:00:00.000Z', now)).toBe('Ended');
  });
});

describe('ec-election card copy', () => {
  it('keeps dashboard labels short', () => {
    expect(electionCardCopy('nominations', false).description).toBe('Contest');
    expect(electionCardCopy('voting', false).description).toBe('Vote');
    expect(electionCardCopy('closed', true).description).toBe('Results');
  });
});
