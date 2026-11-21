'use client';

import { Plus } from 'lucide-react';
import {
  MAX_CONDITIONAL_QUESTIONS,
  followUpsFor,
  isChoiceGate,
  replaceFollowUps,
  type GatedField,
  type ShowWhen,
} from '@/lib/form-conditions';

type FollowUpField = GatedField & {
  label: string;
  description?: string;
  options: string[];
  required: boolean;
  validation?: Record<string, unknown>;
  page_id?: string;
  showWhen?: ShowWhen | null;
};

function newId() {
  return 'f_' + Math.random().toString(36).substring(2, 9);
}

export default function ConditionalFollowUpsEditor<T extends FollowUpField>({
  parent,
  fields,
  onChange,
  onAdded,
}: {
  parent: T;
  fields: T[];
  onChange: (fields: T[]) => void;
  onAdded?: (id: string) => void;
}) {
  if (!isChoiceGate(parent.field_type) || parent.showWhen?.fieldId) return null;

  const options = (parent.options || []).map((o) => o.trim()).filter(Boolean);
  const followUps = followUpsFor(fields, parent.id);
  const trigger = followUps[0]?.showWhen?.option || options.find((o) => /^yes$/i.test(o)) || options[0] || '';

  function commit(nextFollowUps: T[], option = trigger) {
    const stamped = nextFollowUps.slice(0, MAX_CONDITIONAL_QUESTIONS).map((f) => ({
      ...f,
      page_id: parent.page_id,
      showWhen: { fieldId: parent.id, option },
    }));
    onChange(replaceFollowUps(fields, parent.id, stamped) as T[]);
  }

  function addFollowUp() {
    if (!trigger || followUps.length >= MAX_CONDITIONAL_QUESTIONS) return;
    const row = {
      ...parent,
      id: newId(),
      field_type: 'text',
      label: '',
      description: '',
      options: [],
      required: false,
      validation: {},
      page_id: parent.page_id,
      showWhen: { fieldId: parent.id, option: trigger },
    } as T;
    commit([...followUps, row]);
    onAdded?.(row.id);
  }

  if (options.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-sm text-gray-700"
      onClick={(e) => e.stopPropagation()}
    >
      <span>If they select</span>
      <select
        value={trigger}
        onChange={(e) => commit(followUps, e.target.value)}
        className="border rounded-lg px-2 py-1 text-sm bg-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {followUps.length < MAX_CONDITIONAL_QUESTIONS && (
        <button type="button" onClick={addFollowUp} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add follow-up ({followUps.length}/{MAX_CONDITIONAL_QUESTIONS})
        </button>
      )}
    </div>
  );
}
