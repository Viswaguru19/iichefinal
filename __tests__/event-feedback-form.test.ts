import { describe, expect, it } from 'vitest';
import {
  applyFeedbackFieldEdits,
  defaultEventFeedbackFields,
  encodeEventFeedbackDraft,
  latestEventFeedbackDraft,
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
});
