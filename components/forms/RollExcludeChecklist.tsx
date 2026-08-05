'use client';

import { generateRollOptions, excludedRollsFromValidation, type RollValidation } from '@/lib/form-field-types';

type Props = {
  count: number;
  validation: RollValidation;
  onChangeExcluded: (excluded: string[]) => void;
};

/** Checklist: checked = available, unchecked = discontinued (excluded). */
export default function RollExcludeChecklist({ count, validation, onChangeExcluded }: Props) {
  const all = generateRollOptions(count);
  const excluded = new Set(excludedRollsFromValidation(validation));
  const excludedCount = excluded.size;

  function toggle(roll: string, checked: boolean) {
    const next = new Set(excluded);
    if (checked) next.delete(roll);
    else next.add(roll);
    onChangeExcluded([...next].sort((a, b) => Number(a) - Number(b)));
  }

  function setAll(available: boolean) {
    onChangeExcluded(available ? [] : [...all]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Uncheck discontinued roll numbers ({excludedCount} hidden)
        </p>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setAll(true)} className="text-indigo-600 hover:underline">
            All on
          </button>
          <button type="button" onClick={() => setAll(false)} className="text-gray-500 hover:underline">
            All off
          </button>
        </div>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 grid grid-cols-5 sm:grid-cols-8 gap-1">
        {all.map((roll) => {
          const on = !excluded.has(roll);
          return (
            <label
              key={roll}
              className={`flex items-center justify-center gap-1 rounded-md px-1 py-1 text-xs cursor-pointer select-none ${
                on ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-400 line-through'
              }`}
              title={on ? `Roll ${roll} available` : `Roll ${roll} discontinued`}
            >
              <input
                type="checkbox"
                className="rounded text-indigo-600 w-3 h-3"
                checked={on}
                onChange={(e) => toggle(roll, e.target.checked)}
              />
              {roll}
            </label>
          );
        })}
      </div>
    </div>
  );
}
