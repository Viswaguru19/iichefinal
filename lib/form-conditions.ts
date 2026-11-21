/** Extra questions shown only when a choice question is answered a certain way. */

export const MAX_CONDITIONAL_QUESTIONS = 3;

export const CHOICE_GATE_TYPES = ['radio', 'dropdown', 'checkbox', 'checkbox_exact_2', 'limited_choice'] as const;

export const FOLLOW_UP_FIELD_TYPES = [
  { value: 'text', label: 'Short answer' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'radio', label: 'Multiple choice' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'date', label: 'Date' },
] as const;

export type ShowWhen = {
  fieldId: string;
  option: string;
};

export type GatedField = {
  id: string;
  field_type: string;
  options?: string[];
  showWhen?: ShowWhen | null;
  order_index?: number;
};

export function isChoiceGate(type: string): boolean {
  return (CHOICE_GATE_TYPES as readonly string[]).includes(type);
}

export function isFollowUpField(field: { showWhen?: ShowWhen | null }): boolean {
  return Boolean(field.showWhen?.fieldId && String(field.showWhen.option || '').trim());
}

export function followUpsFor<T extends GatedField>(fields: T[], parentId: string): T[] {
  return fields.filter((f) => f.showWhen?.fieldId === parentId);
}

export function choiceAnswerMatches(fieldType: string, answer: unknown, option: string): boolean {
  if (fieldType === 'checkbox' || fieldType === 'checkbox_exact_2') {
    return Array.isArray(answer) && answer.map((item) => String(item)).includes(option);
  }
  return String(answer ?? '') === option;
}

export function isFieldAsked<T extends GatedField>(
  field: T,
  fields: T[],
  answers: Record<string, unknown>,
  seen: Set<string> = new Set(),
): boolean {
  const gate = field.showWhen;
  if (!gate?.fieldId || !String(gate.option || '').trim()) return true;
  if (seen.has(field.id)) return false;
  seen.add(field.id);
  const parent = fields.find((f) => f.id === gate.fieldId);
  if (!parent || !isChoiceGate(parent.field_type)) return false;
  if (!isFieldAsked(parent, fields, answers, seen)) return false;
  return choiceAnswerMatches(parent.field_type, answers[parent.id], gate.option);
}

export function packFollowUps<T extends GatedField>(fields: T[]): T[] {
  const followUps = fields.filter((f) => isFollowUpField(f));
  const tops = fields.filter((f) => !isFollowUpField(f));
  const out: T[] = [];
  for (const top of tops) {
    out.push(top);
    for (const child of followUps) {
      if (child.showWhen?.fieldId === top.id) out.push(child);
    }
  }
  const placed = new Set(out.map((f) => f.id));
  for (const child of followUps) {
    if (!placed.has(child.id)) out.push(child);
  }
  return out.map((f, i) => ({ ...f, order_index: i }));
}

export function replaceFollowUps<T extends GatedField>(fields: T[], parentId: string, next: T[]): T[] {
  const rest = fields.filter((f) => f.showWhen?.fieldId !== parentId);
  const parentIndex = rest.findIndex((f) => f.id === parentId);
  if (parentIndex < 0) return packFollowUps(rest);
  const merged = [...rest.slice(0, parentIndex + 1), ...next, ...rest.slice(parentIndex + 1)];
  return packFollowUps(merged);
}

export function withoutFieldAndFollowUps<T extends GatedField>(fields: T[], fieldId: string): T[] {
  return packFollowUps(fields.filter((f) => f.id !== fieldId && f.showWhen?.fieldId !== fieldId));
}

export function renameGatedOption<T extends GatedField>(
  fields: T[],
  parentId: string,
  from: string,
  to: string,
): T[] {
  if (from === to) return fields;
  return fields.map((f) => {
    if (f.showWhen?.fieldId === parentId && f.showWhen.option === from) {
      return { ...f, showWhen: { fieldId: parentId, option: to } };
    }
    return f;
  });
}

export function dropFollowUpsForOption<T extends GatedField>(
  fields: T[],
  parentId: string,
  option: string,
): T[] {
  return packFollowUps(
    fields.filter((f) => !(f.showWhen?.fieldId === parentId && f.showWhen.option === option)),
  );
}
