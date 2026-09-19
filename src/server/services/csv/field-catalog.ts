import { parseDateOnly } from '@/lib/date';

export type FieldType = 'string' | 'number' | 'date' | 'phone' | 'postal' | 'email';

export interface FieldDefinition {
  /** システム側の項目キー */
  key: string;
  label: string;
  type: FieldType;
  target: 'customer' | 'contract';
  required?: boolean;
  /** CSV 側で使われうるヘッダ名の候補（正規化して比較する） */
  aliases: readonly string[];
}

/**
 * CSV 取込項目カタログ（§8）。
 * サンプル CSV が未提供のため、ここを基本項目とし、実ファイル受領後は alias を追加するだけで対応できる。
 */
export const FIELD_CATALOG: readonly FieldDefinition[] = [
  { key: 'externalCustomerId', label: '顧客ID', type: 'string', target: 'customer',
    aliases: ['顧客ID', '顧客番号', 'お客様番号', 'customerId', 'customer_id', 'customerNo'] },
  { key: 'contractNumber', label: '契約番号', type: 'string', target: 'contract',
    aliases: ['契約番号', '申込番号', '受付番号', '契約No', 'contractNumber', 'contract_no', 'contractNo'] },
  { key: 'customerName', label: '氏名', type: 'string', target: 'customer', required: true,
    aliases: ['氏名', '顧客名', '契約者名', 'お名前', '名前', 'customerName', 'customer_name', 'name', 'NAME'] },
  { key: 'customerNameKana', label: '氏名カナ', type: 'string', target: 'customer',
    aliases: ['氏名カナ', 'フリガナ', 'ふりがな', 'カナ', 'カナ氏名', 'customerNameKana', 'kana'] },
  { key: 'phone', label: '電話番号', type: 'phone', target: 'customer',
    aliases: ['電話番号', '電話', 'TEL', 'tel', '連絡先', '携帯番号', 'phone', 'phoneNumber'] },
  { key: 'email', label: 'メール', type: 'email', target: 'customer',
    aliases: ['メール', 'メールアドレス', 'Email', 'email', 'mail'] },
  { key: 'postalCode', label: '郵便番号', type: 'postal', target: 'customer',
    aliases: ['郵便番号', '〒', 'postalCode', 'postal_code', 'zip'] },
  { key: 'prefecture', label: '都道府県', type: 'string', target: 'customer',
    aliases: ['都道府県', '県', 'prefecture', 'pref'] },
  { key: 'city', label: '市区町村', type: 'string', target: 'customer',
    aliases: ['市区町村', '市町村', 'city'] },
  { key: 'address', label: '住所', type: 'string', target: 'customer',
    aliases: ['住所', '番地', '住所1', 'address', 'address1'] },
  { key: 'building', label: '建物名', type: 'string', target: 'customer',
    aliases: ['建物名', 'マンション名', '建物', '住所2', 'building', 'address2'] },
  { key: 'birthDate', label: '生年月日', type: 'date', target: 'customer',
    aliases: ['生年月日', '誕生日', 'birthDate', 'birth_date', 'birthday'] },
  { key: 'contractedAt', label: '契約日', type: 'date', target: 'contract',
    aliases: ['契約日', '成約日', 'contractDate', 'contract_date', 'contractedAt'] },
  { key: 'appliedAt', label: '申込日', type: 'date', target: 'contract',
    aliases: ['申込日', '受付日', 'applyDate', 'applied_at', 'appliedAt'] },
  { key: 'activatedAt', label: '開通日', type: 'date', target: 'contract',
    aliases: ['開通日', '供給開始日', '利用開始日', 'activatedAt', 'activated_at'] },
  { key: 'supplierName', label: '電力会社', type: 'string', target: 'contract',
    aliases: ['電力会社', '供給会社', '新電力', 'supplier', 'powerCompany', 'power_company'] },
  { key: 'planName', label: '契約プラン', type: 'string', target: 'contract',
    aliases: ['契約プラン', 'プラン', 'プラン名', 'plan', 'planName', 'contractPlan'] },
  { key: 'contractWatt', label: '契約ワット数', type: 'number', target: 'contract',
    aliases: ['契約ワット数', 'ワット数', 'W数', 'W', 'ワット', 'watt', 'contractWatt', 'contract_watt'] },
  { key: 'unitPrice', label: '単価', type: 'number', target: 'contract',
    aliases: ['単価', '円/W', 'unitPrice', 'unit_price'] },
  { key: 'agencyCode', label: '代理店', type: 'string', target: 'contract',
    aliases: ['代理店', '代理店名', '代理店コード', 'agency', 'agencyCode', 'agency_code'] },
  { key: 'staffName', label: '担当者', type: 'string', target: 'contract',
    aliases: ['担当者', '担当', '販売員', 'staff', 'staffName', 'sales'] },
  { key: 'venueName', label: '催事会場', type: 'string', target: 'contract',
    aliases: ['催事会場', '会場', '催事', '店舗', 'venue', 'event', 'eventName'] },
  { key: 'campaign', label: 'キャンペーン', type: 'string', target: 'contract',
    aliases: ['キャンペーン', 'campaign'] },
  { key: 'statusCode', label: 'ステータス', type: 'string', target: 'contract',
    aliases: ['ステータス', '状態', '契約状態', 'status'] },
  { key: 'notes', label: '備考', type: 'string', target: 'contract',
    aliases: ['備考', 'メモ', '特記事項', 'note', 'notes', 'memo', 'remarks'] },
];

export const FIELD_BY_KEY: ReadonlyMap<string, FieldDefinition> = new Map(
  FIELD_CATALOG.map((f) => [f.key, f]),
);

/** 記号・空白・全角半角・大小文字の差を吸収した比較キー。 */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFKC')
    .replace(/[\s_\-./（）()【】「」"'`]/g, '')
    .toLowerCase()
    .trim();
}

const ALIAS_INDEX: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const field of FIELD_CATALOG) {
    map.set(normalizeHeader(field.label), field.key);
    map.set(normalizeHeader(field.key), field.key);
    for (const alias of field.aliases) {
      map.set(normalizeHeader(alias), field.key);
    }
  }
  return map;
})();

/**
 * CSV ヘッダからシステム項目を推測する（STEP3 の初期値）。
 * 推測結果はユーザーが必ず確認・修正できる。
 */
export function suggestFieldKey(header: string): string | null {
  return ALIAS_INDEX.get(normalizeHeader(header)) ?? null;
}

export function suggestMapping(headers: readonly string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const header of headers) {
    const suggested = suggestFieldKey(header);
    if (suggested && !used.has(suggested)) {
      mapping[header] = suggested;
      used.add(suggested);
    } else {
      mapping[header] = null;
    }
  }
  return mapping;
}

// ── 値の正規化 ────────────────────────────────────────────

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.normalize('NFKC').replace(/\D/g, '');
  return digits.length === 0 ? null : digits;
}

export function normalizePostalCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.normalize('NFKC').replace(/\D/g, '');
  if (digits.length !== 7) return value.trim() || null;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function normalizeNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).normalize('NFKC').replace(/[,\s円]/g, '');
  if (cleaned === '') return null;
  // 「5kW」のような表記は W へ換算する
  const kw = /^([\d.]+)\s*k?w$/i.exec(cleaned);
  if (kw?.[1] && /k/i.test(cleaned)) {
    const n = Number(kw[1]);
    return Number.isFinite(n) ? n * 1000 : null;
  }
  const n = Number(cleaned.replace(/[wW]$/, ''));
  return Number.isFinite(n) ? n : null;
}

export interface NormalizeResult {
  value: string | number | Date | null;
  error?: string;
}

export function normalizeValue(field: FieldDefinition, raw: string | null | undefined): NormalizeResult {
  const trimmed = raw === null || raw === undefined ? '' : String(raw).trim();
  if (trimmed === '') {
    if (field.required) return { value: null, error: `${field.label} は必須です。` };
    return { value: null };
  }
  switch (field.type) {
    case 'number': {
      const n = normalizeNumber(trimmed);
      return n === null ? { value: null, error: `${field.label} が数値ではありません: ${trimmed}` } : { value: n };
    }
    case 'date': {
      const d = parseDateOnly(trimmed);
      return d === null ? { value: null, error: `${field.label} が日付として解釈できません: ${trimmed}` } : { value: d };
    }
    case 'phone':
      return { value: normalizePhone(trimmed) };
    case 'postal':
      return { value: normalizePostalCode(trimmed) };
    case 'email': {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      return ok ? { value: trimmed } : { value: null, error: `${field.label} の形式が不正です: ${trimmed}` };
    }
    default:
      return { value: trimmed.normalize('NFKC') };
  }
}
