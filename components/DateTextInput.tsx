'use client';

import { useEffect, useState } from 'react';
import { isoDateToTyped, maskTypedDate, typedDateToIso } from '@/lib/portal-date';

type DateTextInputProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onIsoChange?: (iso: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
};

export default function DateTextInput({
  name,
  value,
  defaultValue,
  onIsoChange,
  required,
  className,
  id,
}: DateTextInputProps) {
  const [text, setText] = useState(() => isoDateToTyped(value || defaultValue || ''));

  useEffect(() => {
    if (value !== undefined) setText(isoDateToTyped(value));
  }, [value]);

  const iso = typedDateToIso(text) || '';

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={text}
        required={required}
        pattern="\d{2}/\d{2}/\d{2}(\d{2})?"
        title="Type date as DD/MM/YYYY"
        className={className}
        onChange={(e) => {
          const next = maskTypedDate(e.target.value, text);
          setText(next);
          onIsoChange?.(typedDateToIso(next) || '');
        }}
        onBlur={() => {
          if (iso) setText(isoDateToTyped(iso));
        }}
      />
      {name ? <input type="hidden" name={name} value={iso} /> : null}
    </>
  );
}
