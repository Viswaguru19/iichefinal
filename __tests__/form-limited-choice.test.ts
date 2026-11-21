import { describe, expect, it } from 'vitest';
import {
  clampOptionMax,
  defaultOptionsForFieldType,
  defaultValidationForFieldType,
  isLimitedChoiceField,
  isLimitedChoiceFull,
  isOptionFieldType,
  LIMITED_CHOICE_DEFAULT_MAX,
  limitedChoiceSeatsLabel,
  optionMaxFromValidation,
} from '@/lib/form-field-types';

describe('limited choice fields', () => {
  it('is an option field with two default slots at 100 each', () => {
    expect(isOptionFieldType('limited_choice')).toBe(true);
    expect(isLimitedChoiceField('limited_choice')).toBe(true);
    expect(defaultOptionsForFieldType('limited_choice')).toEqual(['Slot 1', 'Slot 2']);
    expect(defaultValidationForFieldType('limited_choice').optionMax).toEqual([
      LIMITED_CHOICE_DEFAULT_MAX,
      LIMITED_CHOICE_DEFAULT_MAX,
    ]);
  });

  it('pads and clamps max entries per option', () => {
    expect(optionMaxFromValidation(['A', 'B'], { optionMax: [50] })).toEqual([50, 100]);
    expect(clampOptionMax(0)).toBe(100);
    expect(clampOptionMax(12.9)).toBe(12);
  });

  it('marks an option full at its cap', () => {
    expect(isLimitedChoiceFull(100, 100)).toBe(true);
    expect(isLimitedChoiceFull(99, 100)).toBe(false);
  });

  it('shows remaining seats only once 10 or fewer are left', () => {
    expect(limitedChoiceSeatsLabel(90, 100)).toBe('Only 10 seats available');
    expect(limitedChoiceSeatsLabel(99, 100)).toBe('Only 1 seat available');
    expect(limitedChoiceSeatsLabel(89, 100)).toBeNull();
    expect(limitedChoiceSeatsLabel(100, 100)).toBeNull();
  });
});
