import { FIELD_BY_KEY } from '@/server/services/csv/field-catalog';
import type { RowIssue } from './types';

/**
 * 行の業務バリデーション（§PHASE2「バリデーション」）。
 *
 * 型レベルの検証（数値に文字が入っている等）は csv/field-catalog の normalizeValue が行い、
 * ここでは「業務上ありえない値」と「マスタと突合できない値」を検出する。
 */

export interface ValidationContext {
  /** 解決済みの代理店 ID（null なら解決できなかった） */
  agencyId: string | null;
  agencyRawValue: string | null;
  unknownAgencyLevel: 'error' | 'warning';
  statusId: string | null;
  statusRawValue: string | null;
  /** マスタから解決した単価。CSV の単価と突き合わせる。 */
  masterUnitPrice: number | null;
  /**
   * 数量（W もしくは使用量）が必須か。
   * 明細なしの定額手数料だけで成立する商流では false にする。
   */
  requiresQuantity: boolean;
}

const PHONE_PATTERN = /^0\d{9,10}$/;

export function validateRow(
  values: Record<string, string | number | Date | null>,
  ctx: ValidationContext,
): RowIssue[] {
  const issues: RowIssue[] = [];

  // ── 氏名（必須）──
  const name = values.customerName;
  if (typeof name !== 'string' || name.trim() === '') {
    issues.push({ level: 'error', field: 'customerName', message: '氏名が空です。' });
  }

  // ── 契約番号 ──
  const contractNumber = values.contractNumber;
  if (contractNumber !== null && contractNumber !== undefined && typeof contractNumber === 'string' && contractNumber.length > 64) {
    issues.push({ level: 'error', field: 'contractNumber', message: '契約番号が長すぎます（64文字以内）。' });
  }
  if (!contractNumber && !values.externalCustomerId) {
    issues.push({
      level: 'warning',
      field: 'contractNumber',
      message: '契約番号・顧客IDがどちらも空です。重複判定が電話番号＋氏名のみになります。',
    });
  }

  // ── 電話番号 ──
  const phone = values.phone;
  if (typeof phone === 'string' && phone !== '' && !PHONE_PATTERN.test(phone)) {
    issues.push({ level: 'warning', field: 'phone', message: `電話番号の形式が想定と異なります: ${phone}` });
  }
  if (!phone && !values.externalCustomerId && !contractNumber) {
    issues.push({ level: 'error', field: 'phone', message: '契約番号・顧客ID・電話番号がすべて空のため突合できません。' });
  }

  // ── 数量の基準（ワット数 または 使用量）──
  // 商流によって課金の基準が異なるため、どちらか一方があればよい。
  //   ・円/W 方式        → 契約ワット数
  //   ・階段表方式        → 明細の使用量(kWh)
  //   ・明細なしの定額方式 → どちらも不要
  const watt = values.contractWatt;
  const usage = values.actualUsageKwh;
  const hasWatt = typeof watt === 'number' && watt > 0;
  const hasUsage = typeof usage === 'number' && usage > 0;

  if (watt !== null && watt !== undefined && typeof watt !== 'number') {
    issues.push({ level: 'error', field: 'contractWatt', message: '契約ワット数が数値ではありません。' });
  } else if (typeof watt === 'number' && watt < 0) {
    issues.push({ level: 'error', field: 'contractWatt', message: `契約ワット数が負です: ${watt}` });
  } else if (typeof watt === 'number' && watt > 1_000_000) {
    issues.push({ level: 'warning', field: 'contractWatt', message: `契約ワット数が異常に大きい値です: ${watt}` });
  }

  if (usage !== null && usage !== undefined && typeof usage !== 'number') {
    issues.push({ level: 'error', field: 'actualUsageKwh', message: '使用量(kWh)が数値ではありません。' });
  } else if (typeof usage === 'number' && usage < 0) {
    issues.push({ level: 'error', field: 'actualUsageKwh', message: `使用量(kWh)が負です: ${usage}` });
  } else if (typeof usage === 'number' && usage > 100_000) {
    issues.push({ level: 'warning', field: 'actualUsageKwh', message: `使用量(kWh)が異常に大きい値です: ${usage}` });
  }

  if (!hasWatt && !hasUsage && ctx.requiresQuantity) {
    issues.push({
      level: 'error',
      field: 'contractWatt',
      message: '契約ワット数と使用量(kWh)がどちらも空です。手数料を算定できません。',
    });
  }

  // ── 検針月 ──
  const usageMonth = values.usageMonth;
  if (typeof usageMonth === 'number' && (usageMonth < 1 || usageMonth > 12 || !Number.isInteger(usageMonth))) {
    issues.push({ level: 'error', field: 'usageMonth', message: `検針月が 1〜12 の範囲外です: ${usageMonth}` });
  }
  if (hasUsage && usageMonth === null) {
    issues.push({
      level: 'warning',
      field: 'usageMonth',
      message: '検針月が空のため、契約日の月の季節係数を適用します。',
    });
  }

  // ── 契約日 ──
  const contractedAt = values.contractedAt;
  const appliedAt = values.appliedAt;
  if (!(contractedAt instanceof Date) && !(appliedAt instanceof Date)) {
    issues.push({ level: 'error', field: 'contractedAt', message: '契約日・申込日がどちらも解釈できません。' });
  }
  for (const [key, value] of [['contractedAt', contractedAt], ['appliedAt', appliedAt], ['activatedAt', values.activatedAt], ['birthDate', values.birthDate]] as const) {
    if (value instanceof Date) {
      const year = value.getFullYear();
      if (year < 1900 || year > 2100) {
        issues.push({ level: 'warning', field: key, message: `${FIELD_BY_KEY.get(key)?.label ?? key} の年が想定外です: ${year}` });
      }
    }
  }

  // ── 代理店 ──
  if (!ctx.agencyId) {
    issues.push({
      level: ctx.unknownAgencyLevel,
      field: 'agencyCode',
      message: ctx.agencyRawValue
        ? `代理店「${ctx.agencyRawValue}」がマスタに存在しません。`
        : '代理店を特定できません。CSV に代理店列が無い場合は取込先の代理店を指定してください。',
    });
  }

  // ── 契約ステータス ──
  if (!ctx.statusId) {
    issues.push({
      level: 'error',
      field: 'statusCode',
      message: ctx.statusRawValue
        ? `契約ステータス「${ctx.statusRawValue}」がマスタに存在しません。`
        : '契約ステータスを特定できません。既定ステータスを設定してください。',
    });
  }

  // ── 単価（CSV の値はマスタと突き合わせるだけ。金額はマスタを正とする）──
  const csvUnitPrice = values.unitPrice;
  if (typeof csvUnitPrice === 'number' && ctx.masterUnitPrice !== null && csvUnitPrice !== ctx.masterUnitPrice) {
    issues.push({
      level: 'warning',
      field: 'unitPrice',
      message: `CSV の単価 ${csvUnitPrice} が単価マスタ（${ctx.masterUnitPrice}）と一致しません。金額はマスタの単価で計算されます。`,
    });
  }

  return issues;
}
