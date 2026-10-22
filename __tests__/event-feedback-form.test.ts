import { describe, expect, it } from 'vitest';
import {
  applyFeedbackFieldEdits,
  defaultEventFeedbackFields,
  encodeEventFeedbackDraft,
  FEEDBACK_PARTICIPANT_META_KEY,
  latestEventFeedbackDraft,
  matchRosterFeedback,
} from '@/lib/event-feedback-form';

describe('event feedback form draft', () => {
  it('adds speaker talk questions when the event has a guest', () => {
    const fields = defaultEventFeedbackFields({
      title: 'Guest Lecture',
      guest_name: 'Dr Rao',
      location: 'Amriteshwari Hall',
    });
    expect(fields.some((f) => /Dr Rao's talk/i.test(f.label))).toBe(true);
    expect(fields.some((f) => /Comments for Dr Rao/i.test(f.label))).toBe(true);
  });

  it('applies remove and add edits from a follow-up', () => {
    const start = defaultEventFeedbackFields({ title: 'Orientation', location: 'Hall' });
    const next = applyFeedbackFieldEdits(start, 'remove the venue question and add food rating');
    expect(next.some((f) => /venue/i.test(f.label))).toBe(false);
    expect(next.some((f) => /food/i.test(f.label))).toBe(true);
  });

  it('reads the last draft token from chat history', () => {
    const token = encodeEventFeedbackDraft({
      eventId: 'e1',
      eventTitle: 'Orientation',
      title: 'Feedback: Orientation',
      description: '',
      fields: [{ label: 'Rate it', type: 'radio', options: ['1', '2', '3', '4', '5'] }],
    });
    const draft = latestEventFeedbackDraft([
      { role: 'assistant', content: `## Draft\nFEEDBACK_FORM_DRAFT:${token};;` },
    ]);
    expect(draft?.eventId).toBe('e1');
    expect(draft?.fields[0].label).toBe('Rate it');
  });

  it('starts with a searchable participant name and auto-filled roll', () => {
    const fields = defaultEventFeedbackFields({ title: 'Orientation' });
    expect(fields[0]).toMatchObject({ label: 'Your name', type: 'event_participant', required: true });
    expect(fields[1]).toMatchObject({ label: 'Roll number', type: 'text', required: true });
  });

  it('attributes submitted feedback to roster people and lists who did not', () => {
    const fields = [
      { id: 'n', label: 'Your name', field_type: 'event_participant' },
      { id: 'r', label: 'Roll number', field_type: 'text' },
      { id: 'c', label: 'What did you like most?', field_type: 'textarea' },
    ];
    const status = matchRosterFeedback(
      [
        { id: 'p1', participant_name: 'Asha', participant_email: 'CB.EN.U4CHE20001' },
        { id: 'p2', participant_name: 'Bala', participant_email: 'CB.EN.U4CHE20002' },
      ],
      [
        {
          responses: {
            [FEEDBACK_PARTICIPANT_META_KEY]: 'p1',
            'Your name': 'Asha',
            'Roll number': 'CB.EN.U4CHE20001',
            'What did you like most?': 'The talk',
          },
        },
      ],
      fields,
    );
    expect(status.givenCount).toBe(1);
    expect(status.given[0].name).toBe('Asha');
    expect(status.given[0].answers[0].text).toBe('The talk');
    expect(status.pending.map((p) => p.name)).toEqual(['Bala']);
  });
});
