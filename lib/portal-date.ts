const IST = 'Asia/Kolkata';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Calendar date from YYYY-MM-DD (no timezone shift). */
function fromIsoDay(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function parsePortalDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]00:00:00(?:\.\d+)?(?:Z)?)?$/);
  if (isoDay) return fromIsoDay(Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3]));

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (dmy[3].length === 2) year += 2000;
    return fromIsoDay(year, Number(dmy[2]), Number(dmy[1]));
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatIstParts(d: Date, withTime: boolean): { day: string; month: string; year: string; time?: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime
      ? { hour: '2-digit', minute: '2-digit', hour12: true }
      : {}),
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';
  const time = withTime ? `${get('hour')}:${get('minute')} ${get('dayPeriod')}`.replace(/\s+/g, ' ').trim() : undefined;
  return { day: get('day'), month: get('month'), year: get('year'), time };
}

/** Display dates as DD/MM/YYYY. */
export function formatPortalDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]00:00:00(?:\.\d+)?(?:Z)?)?$/);
  if (isoDay) return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;

  const d = parsePortalDate(value);
  if (!d) return '';
  const { day, month, year } = formatIstParts(d, false);
  return `${day}/${month}/${year}`;
}

/** Display timestamps as DD/MM/YYYY HH:MM AM/PM (IST). */
export function formatPortalDateTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatPortalDate(raw);
  const d = parsePortalDate(value);
  if (!d) return '';
  const { day, month, year, time } = formatIstParts(d, true);
  return time ? `${day}/${month}/${year} ${time}` : `${day}/${month}/${year}`;
}

export function toIsoDate(value: string | number | Date | null | undefined): string {
  const d = parsePortalDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Insert slashes while typing: DD/ → DD/MM/ → DD/MM/YYYY. */
export function maskTypedDate(raw: string, previous = ''): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const prevDigits = previous.replace(/\D/g, '');
  const adding = digits.length > prevDigits.length;
  if (digits.length <= 2) {
    return adding && digits.length === 2 ? `${digits}/` : digits;
  }
  if (digits.length <= 4) {
    const body = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return adding && digits.length === 4 ? `${body}/` : body;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function typedDateToIso(masked: string): string | null {
  const four = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const two = masked.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  const m = four || two;
  if (!m) return null;
  let year = Number(m[3]);
  if (m[3].length === 2) year += 2000;
  const month = Number(m[2]);
  const day = Number(m[1]);
  const d = fromIsoDay(year, month, day);
  return d ? `${year}-${pad2(month)}-${pad2(day)}` : null;
}

export function isoDateToTyped(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatPortalDate(iso.split('T')[0]);
}
