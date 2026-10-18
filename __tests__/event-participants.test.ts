import { describe, expect, it } from 'vitest';
import {
  parseBulkParticipantLines,
  participantSecondaryText,
  buildAttendanceReportCsv,
  FORM_REGISTRATION_GROUP,
  ON_SPOT_REGISTRATION_GROUP,
} from '@/lib/event-participant-groups';

describe('parseBulkParticipantLines', () => {
  it('parses name-only lines and CSV with emails', () => {
    const rows = parseBulkParticipantLines('Rahul\nPriya,priya@amrita.edu', '1st years');
    expect(rows).toEqual([
      { name: 'Rahul', email: '', group: '1st years' },
      { name: 'Priya', email: 'priya@amrita.edu', group: '1st years' },
    ]);
  });

  it('keeps a roll number as the second field', () => {
    const rows = parseBulkParticipantLines('viswaguru,cb.en.u4che24063');
    expect(rows).toEqual([{ name: 'viswaguru', email: 'cb.en.u4che24063', group: '' }]);
    expect(participantSecondaryText(rows[0].email)).toBe('cb.en.u4che24063');
    expect(participantSecondaryText('')).toBe('');
  });

  it('splits a one-line paste of name,roll pairs', () => {
    const rows = parseBulkParticipantLines(
      '```text Abhishek Alfred Raj M,CB.EN.U4CHE26102 Alvin Ani Kuriakose,CB.EN.U4CHE26103```',
    );
    expect(rows).toEqual([
      { name: 'Abhishek Alfred Raj M', email: 'CB.EN.U4CHE26102', group: '' },
      { name: 'Alvin Ani Kuriakose', email: 'CB.EN.U4CHE26103', group: '' },
    ]);
  });

  it('parses Excel TSV and a header row', () => {
    const rows = parseBulkParticipantLines('Name\tEmail\nAsha\tasha@amrita.edu');
    expect(rows).toEqual([{ name: 'Asha', email: 'asha@amrita.edu', group: '' }]);
  });

  it('maps SL No, Roll No, Name regardless of column order', () => {
    const rows = parseBulkParticipantLines(
      [
        ',,',
        'SL No,Roll No,Name',
        '1,CB.EN.U4CHE26101,Adwin A',
        '2,CB.EN.U4CHE26102,Akshara Ravikumar',
      ].join('\n'),
      'CHE A',
    );
    expect(rows).toEqual([
      { name: 'Adwin A', email: 'CB.EN.U4CHE26101', group: 'CHE A' },
      { name: 'Akshara Ravikumar', email: 'CB.EN.U4CHE26102', group: 'CHE A' },
    ]);
  });
});

describe('buildAttendanceReportCsv', () => {
  const people = [
    {
      participant_name: 'Asha',
      participant_email: 'CB.EN.1',
      participant_group: 'CHE A',
      registration_source: 'bulk_import',
      attendance_status: 'present',
    },
    {
      participant_name: 'Rahul',
      participant_email: 'CB.EN.2',
      participant_group: 'CHE A',
      registration_source: 'bulk_import',
      attendance_status: 'registered',
    },
    {
      participant_name: 'Form Student',
      participant_email: 'form@amrita.edu',
      participant_group: null,
      registration_source: 'advance',
      attendance_status: null,
    },
    {
      participant_name: 'Walk In',
      participant_email: '',
      participant_group: null,
      registration_source: 'on_site',
      attendance_status: 'present',
    },
  ];

  it('puts unmarked people as absent and group names as section headings', () => {
    const csv = buildAttendanceReportCsv(people, ['CHE A'], false);
    expect(csv).toContain('"CHE A"');
    expect(csv).toContain(`"${FORM_REGISTRATION_GROUP}"`);
    expect(csv).toContain(`"${ON_SPOT_REGISTRATION_GROUP}"`);
    expect(csv).toContain('"Walk In","","Present"');
    expect(csv).toContain('"Asha","CB.EN.1","Present"');
    expect(csv).toContain('"Rahul","CB.EN.2","Absent"');
    expect(csv).not.toMatch(/^Serial,Name,Email,Group,/m);
  });

  it('can add group as a column instead', () => {
    const csv = buildAttendanceReportCsv(people, ['CHE A'], true);
    expect(csv.startsWith('Serial,Name,Email,Group,Attendance,Marked At')).toBe(true);
    expect(csv).toContain('"Form Student","form@amrita.edu","Registered through form","Absent"');
    expect(csv).toContain('"Walk In","","On-spot registration","Present"');
  });
});
