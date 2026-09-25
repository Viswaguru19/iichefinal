import { describe, expect, it } from 'vitest';
import {
  formatPortalDate,
  formatPortalDateTime,
  isoDateToTyped,
  maskTypedDate,
  typedDateToIso,
} from '@/lib/portal-date';

describe('portal dates', () => {
  it('formats calendar dates as DD/MM/YYYY', () => {
    expect(formatPortalDate('2026-09-25')).toBe('25/09/2026');
    expect(formatPortalDate('2026-09-25T00:00:00.000Z')).toBe('25/09/2026');
    expect(isoDateToTyped('2026-09-25T18:30:00.000Z')).toBe('25/09/2026');
  });

  it('inserts slashes while typing DD then MM then YY', () => {
    expect(maskTypedDate('2', '')).toBe('2');
    expect(maskTypedDate('25', '2')).toBe('25/');
    expect(maskTypedDate('250', '25/')).toBe('25/0');
    expect(maskTypedDate('2509', '25/0')).toBe('25/09/');
    expect(maskTypedDate('250926', '25/09/')).toBe('25/09/26');
    expect(maskTypedDate('25092026', '25/09/26')).toBe('25/09/2026');
  });

  it('lets backspace remove a trailing slash', () => {
    expect(maskTypedDate('25', '25/')).toBe('25');
    expect(maskTypedDate('25/09', '25/09/')).toBe('25/09');
  });

  it('parses typed dates including two-digit years', () => {
    expect(typedDateToIso('25/09/2026')).toBe('2026-09-25');
    expect(typedDateToIso('25/09/26')).toBe('2026-09-25');
    expect(typedDateToIso('31/02/2026')).toBeNull();
    expect(typedDateToIso('25/09')).toBeNull();
  });

  it('keeps a time when formatting timestamps', () => {
    const text = formatPortalDateTime('2026-09-25T10:30:00+05:30');
    expect(text.startsWith('25/09/2026')).toBe(true);
    expect(text).toMatch(/\d{1,2}:\d{2}/);
  });
});
