export type StatementRow = {
  id?: string;
  date: string;
  created_at?: string;
  sr_no?: number | null;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
};

export function statementDateKey(value: string | null | undefined): string {
  return String(value || '').slice(0, 10);
}

export function sortStatementRows<T extends StatementRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = statementDateKey(a.date);
    const db = statementDateKey(b.date);
    if (da !== db) return da.localeCompare(db);
    const ca = String(a.created_at || '');
    const cb = String(b.created_at || '');
    if (ca !== cb) return ca.localeCompare(cb);
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

export function withSequentialLedger<T extends StatementRow>(
  rows: T[],
): (T & { sr_no: number; balance: number })[] {
  let balance = 0;
  return sortStatementRows(rows).map((row, index) => {
    balance += (Number(row.credit) || 0) - (Number(row.debit) || 0);
    return { ...row, sr_no: index + 1, balance };
  });
}
