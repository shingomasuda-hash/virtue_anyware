import { roundYen } from '@/lib/money';

/** 階段式手数料表の 1 行。「minValue 以上 maxValue 未満 → amount 円」。 */
export interface PriceTier {
  id?: string | null;
  /** 下限（以上） */
  minValue: number;
  /** 上限（未満）。null は上限なし。 */
  maxValue: number | null;
  amount: number;
}

export interface TierMatch {
  tier: PriceTier | null;
  amount: number;
}

/**
 * 階段表から金額を引く。
 *
 * 境界は **「minValue 以上 maxValue 未満」**（条件表の表記どおり）。
 * 該当する行が無い場合は 0 円を返す（表の最下段が 0 円のケースがあるため、
 * 「該当なし」と「0 円」を区別できるよう tier を null で返す）。
 */
export function lookupTier(tiers: readonly PriceTier[], value: number): TierMatch {
  if (!Number.isFinite(value)) return { tier: null, amount: 0 };

  for (const tier of tiers) {
    const aboveMin = value >= tier.minValue;
    const belowMax = tier.maxValue === null || value < tier.maxValue;
    if (aboveMin && belowMax) {
      return { tier, amount: roundYen(tier.amount) };
    }
  }
  return { tier: null, amount: 0 };
}

/**
 * 階段表の健全性チェック。マスタ登録時に使う。
 * 「隙間」「重なり」があると手数料が 0 円になったり二重定義になるため、登録前に検出する。
 */
export interface TierValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

export function validateTiers(tiers: readonly PriceTier[]): TierValidationIssue[] {
  const issues: TierValidationIssue[] = [];
  if (tiers.length === 0) {
    issues.push({ level: 'error', message: '階段表に 1 行も登録されていません。' });
    return issues;
  }

  const sorted = [...tiers].sort((a, b) => a.minValue - b.minValue);

  for (const tier of sorted) {
    if (tier.maxValue !== null && tier.maxValue <= tier.minValue) {
      issues.push({
        level: 'error',
        message: `上限が下限以下です: ${tier.minValue} 以上 ${tier.maxValue} 未満`,
      });
    }
    if (tier.amount < 0) {
      issues.push({ level: 'error', message: `金額が負です: ${tier.amount}` });
    }
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!current || !next) continue;
    if (current.maxValue === null) {
      issues.push({ level: 'error', message: '上限なしの行より後ろに行が存在します。' });
      continue;
    }
    if (current.maxValue < next.minValue) {
      issues.push({
        level: 'warning',
        message: `階段に隙間があります: ${current.maxValue} 以上 ${next.minValue} 未満が未定義です。`,
      });
    }
    if (current.maxValue > next.minValue) {
      issues.push({
        level: 'error',
        message: `階段が重複しています: ${next.minValue} 付近で 2 つの行が該当します。`,
      });
    }
  }

  const first = sorted[0];
  if (first && first.minValue > 0) {
    issues.push({
      level: 'warning',
      message: `${first.minValue} 未満が未定義です。該当する契約は 0 円になります。`,
    });
  }
  const last = sorted[sorted.length - 1];
  if (last && last.maxValue !== null) {
    issues.push({
      level: 'warning',
      message: `${last.maxValue} 以上が未定義です。該当する契約は 0 円になります。`,
    });
  }

  return issues;
}
