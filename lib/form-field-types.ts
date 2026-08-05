/** Form field types that store a list of selectable options. */
export const OPTION_FIELD_TYPES = ['radio', 'checkbox', 'dropdown', 'checkbox_exact_2'] as const;

export function isOptionFieldType(type: string): boolean {
  return (OPTION_FIELD_TYPES as readonly string[]).includes(type);
}

export function defaultOptionsForFieldType(type: string): string[] {
  if (type === 'checkbox_exact_2') return ['Option 1', 'Option 2'];
  if (isOptionFieldType(type)) return ['Option 1'];
  return [];
}

export const EXACT_TWO_HINT = 'Select exactly 2 options';

/** Roll No searchable dropdown: creator sets how many rolls (1…N). */
export const ROLL_NO_MIN_COUNT = 1;
export const ROLL_NO_MAX_COUNT = 99;
export const ROLL_NO_DEFAULT_COUNT = 45;
export const ROLL_NO_HINT = 'Search and select your roll number';

export type RollValidation = {
  minValue?: number;
  maxValue?: number;
  /** Discontinued roll numbers hidden from the dropdown (e.g. ["7","12"]). */
  excludedRolls?: string[];
};

export function clampRollCount(count: number): number {
  if (!Number.isFinite(count)) return ROLL_NO_DEFAULT_COUNT;
  return Math.min(ROLL_NO_MAX_COUNT, Math.max(ROLL_NO_MIN_COUNT, Math.floor(count)));
}

export function rollCountFromValidation(validation?: { maxValue?: number } | null): number {
  return clampRollCount(validation?.maxValue ?? ROLL_NO_DEFAULT_COUNT);
}

export function excludedRollsFromValidation(validation?: RollValidation | null): string[] {
  const raw = validation?.excludedRolls;
  if (!Array.isArray(raw)) return [];
  const max = rollCountFromValidation(validation);
  const set = new Set<string>();
  for (const item of raw) {
    const s = String(item).trim();
    if (!/^\d{1,2}$/.test(s)) continue;
    const n = Number(s);
    if (n >= 1 && n <= max) set.add(String(n));
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

/** Generate roll labels "1" … "N". */
export function generateRollOptions(count: number): string[] {
  const n = clampRollCount(count);
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

/** Rolls available for selection (skips discontinued). */
export function generateAvailableRollOptions(
  count: number,
  excluded?: string[] | null,
): string[] {
  const taken = new Set((excluded || []).map((x) => String(x).trim()));
  return generateRollOptions(count).filter((o) => !taken.has(o));
}

export function defaultValidationForFieldType(type: string): {
  maxFileSize?: number;
  maxFiles?: number;
  allowedFileTypes?: string[];
  minValue?: number;
  maxValue?: number;
  excludedRolls?: string[];
} {
  if (type === 'file') {
    return { maxFileSize: 10, maxFiles: 1, allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'] };
  }
  if (type === 'roll_no') {
    return { minValue: 1, maxValue: ROLL_NO_DEFAULT_COUNT, excludedRolls: [] };
  }
  return {};
}

export function isValidRollNo(
  value: unknown,
  maxCount: number,
  excluded?: string[] | null,
): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!/^\d{1,2}$/.test(s)) return false;
  const n = Number(s);
  const max = clampRollCount(maxCount);
  if (n < 1 || n > max) return false;
  if ((excluded || []).map(String).includes(s) || (excluded || []).map(String).includes(String(n))) {
    return false;
  }
  return true;
}
