export type DateRange = { from: Date; to: Date };

export type PeriodPreset =
  | 'today'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

/** 期間プリセットを日付範囲へ変換する。ダッシュボードの期間セレクタの単一実装。 */
export function resolvePeriod(preset: PeriodPreset, now = new Date(), custom?: Partial<DateRange>): DateRange {
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'last_month': {
      const prev = addMonths(startOfMonth(now), -1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1);
      return { from, to: endOfMonth(new Date(now.getFullYear(), q * 3 + 2, 1)) };
    }
    case 'this_year':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(new Date(now.getFullYear(), 11, 31)) };
    case 'custom':
      return {
        from: custom?.from ? startOfDay(custom.from) : startOfMonth(now),
        to: custom?.to ? endOfDay(custom.to) : endOfMonth(now),
      };
    case 'this_month':
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 期間内の月キー一覧（グラフの欠損月を 0 で埋めるために使う）。 */
export function monthsBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = startOfMonth(from);
  while (cursor <= to) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.trim().replace(/[./]/g, '-').replace(/年|月/g, '-').replace(/日/g, '');
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (m) {
    const [, y, mo, d] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
