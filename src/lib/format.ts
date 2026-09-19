const yenFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });

export function formatYen(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `¥${yenFormatter.format(Math.round(value))}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return decimalFormatter.format(value);
}

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return yenFormatter.format(Math.round(value));
}

export function formatWatt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${yenFormatter.format(Math.round(value))} W`;
}

/** 0-1 の比率を % 表示する。null は比較不能として `—`。 */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 一覧での PII 部分マスク（§31）。 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function maskAddress(address: string | null | undefined): string {
  if (!address) return '—';
  return address.length <= 10 ? address : `${address.slice(0, 10)}…`;
}
