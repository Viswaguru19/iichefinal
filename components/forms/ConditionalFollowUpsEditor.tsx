'use client';

import { Plus, X } from 'lucide-react';
import {
  FOLLOW_UP_FIELD_TYPES,
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
}: {
  parent: T;
  fields: T[];
  onChange: (fields: T[]) => void;
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
  }

  function patch(id: string, updates: Partial<T>) {
    commit(followUps.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  if (options.length === 0) return null;

  return (
    <div
      className="bg-indigo-50/70 rounded-xl p-4 space-y-3 mt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-indigo-700">
        Response-based questions. Example: if they select Yes, ask up to {MAX_CONDITIONAL_QUESTIONS} more questions. Any other answer skips them.
      </p>
      <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        If they select
        <select
          value={trigger}
          onChange={(e) => commit(followUps, e.target.value)}
          className="border rounded-lg px-2 py-1 text-sm bg-white"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        ask up to {MAX_CONDITIONAL_QUESTIONS} questions
      </label>
      {followUps.map((follow, i) => (
        <div key={follow.id} className="bg-white/80 rounded-lg p-3 space-y-2 border border-indigo-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
            <input
              type="text"
              value={follow.label}
              onChange={(e) => patch(follow.id, { label: e.target.value } as Partial<T>)}
              placeholder="Follow-up question"
              className="flex-1 bg-transparent border-b border-gray-200 focus:border-indigo-400 outline-none py-1 text-sm"
            />
            <button type="button" onClick={() => commit(followUps.filter((f) => f.id !== follow.id))} className="text-gray-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pl-6">
            <select
              value={FOLLOW_UP_FIELD_TYPES.some((t) => t.value === follow.field_type) ? follow.field_type : 'text'}
              onChange={(e) => {
                const field_type = e.target.value;
                const optionsForType = field_type === 'radio' || field_type === 'dropdown'
                  ? (follow.options?.length ? follow.options : ['Option 1', 'Option 2'])
                  : [];
                patch(follow.id, { field_type, options: optionsForType } as Partial<T>);
              }}
              className="text-xs border rounded-lg px-2 py-1 bg-white"
            >
              {FOLLOW_UP_FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={follow.required}
                onChange={(e) => patch(follow.id, { required: e.target.checked } as Partial<T>)}
                className="rounded text-indigo-600"
              />
              Required
            </label>
          </div>
          {(follow.field_type === 'radio' || follow.field_type === 'dropdown') && (
            <div className="pl-6 space-y-1">
              {(follow.options || []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const optionsNext = [...(follow.options || [])];
                      optionsNext[oi] = e.target.value;
                      patch(follow.id, { options: optionsNext } as Partial<T>);
                    }}
                    className="flex-1 bg-transparent border-b border-gray-200 outline-none py-0.5 text-xs"
                  />
                  {(follow.options || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => patch(follow.id, { options: follow.options.filter((_, j) => j !== oi) } as Partial<T>)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch(follow.id, { options: [...(follow.options || []), `Option ${(follow.options || []).length + 1}`] } as Partial<T>)}
                className="text-indigo-600 text-xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add option
              </button>
            </div>
          )}
        </div>
      ))}
      {followUps.length < MAX_CONDITIONAL_QUESTIONS && (
        <button type="button" onClick={addFollowUp} className="text-indigo-600 text-sm hover:text-indigo-700 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add follow-up question ({followUps.length}/{MAX_CONDITIONAL_QUESTIONS})
        </button>
      )}
    </div>
  );
}
