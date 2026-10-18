import { describe, expect, it } from 'vitest';
import { parseBulkParticipantLines } from '@/lib/event-participant-groups';

describe('parseBulkParticipantLines', () => {
  it('parses name-only lines and CSV with emails', () => {
    const rows = parseBulkParticipantLines('Rahul\nPriya,priya@amrita.edu', '1st years');
    expect(rows).toEqual([
      { name: 'Rahul', email: '', group: '1st years' },
      { name: 'Priya', email: 'priya@amrita.edu', group: '1st years' },
    ]);
  });

  it('parses Excel TSV and a header row', () => {
    const rows = parseBulkParticipantLines('Name\tEmail\nAsha\tasha@amrita.edu');
    expect(rows).toEqual([{ name: 'Asha', email: 'asha@amrita.edu', group: '' }]);
  });
});
