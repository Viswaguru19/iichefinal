import { describe, expect, it } from 'vitest';
import { isFieldAsked, MAX_CONDITIONAL_QUESTIONS, replaceFollowUps } from '@/lib/form-conditions';

const parent = { id: 'q1', field_type: 'radio', options: ['Yes', 'No'] };
const extra = [
  { id: 'f1', field_type: 'text', showWhen: { fieldId: 'q1', option: 'Yes' } },
  { id: 'f2', field_type: 'text', showWhen: { fieldId: 'q1', option: 'Yes' } },
];

describe('choice follow-up questions', () => {
  it('asks up to 3 extra questions only when that answer is selected', () => {
    expect(MAX_CONDITIONAL_QUESTIONS).toBe(3);
    const fields = [parent, ...extra];
    expect(isFieldAsked(extra[0], fields, { q1: 'Yes' })).toBe(true);
    expect(isFieldAsked(extra[0], fields, { q1: 'No' })).toBe(false);
    expect(isFieldAsked(extra[1], fields, {})).toBe(false);
    expect(isFieldAsked(parent, fields, {})).toBe(true);
  });

  it('keeps follow-ups attached to the choice that triggers them', () => {
    const packed = replaceFollowUps([parent], parent.id, extra);
    expect(packed.map((f) => f.id)).toEqual(['q1', 'f1', 'f2']);
    expect(packed[1].showWhen).toEqual({ fieldId: 'q1', option: 'Yes' });
  });
});
