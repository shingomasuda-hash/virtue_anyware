import type { ClawbackReason } from '@/generated/prisma';

/**
 * 戻入（クローバック）判定。条件表「戻入条件」を実装する。
 *
 * ① 供給開始に至らなかった場合
 *    申込データ投入完了月を 1 か月目として、3 か月目の末日までに供給開始に至らなかった案件は
 *    支払済みの成約事務手数料の全額を、4 か月目の末日までに返還する。
 *
 * ② 短期解約・プラン変更の場合
 *    供給開始した月を 1 か月目として 6 か月目の末日までに契約終了、または
 *    自社の責めに帰すべき事由によるプラン変更となった地点は戻入対象。
 *
 * ③ 提出資料の不正・虚偽があった場合
 *    期限の定めなし。発覚時に全額返還（＋損害賠償）。
 */

export interface ClawbackPolicy {
  /** ①: 申込月を 1 か月目として、何か月目の末日までに供給開始が必要か */
  supplyStartDeadlineMonths: number;
  /** ①: 返還期限（申込月を 1 か月目として何か月目の末日か） */
  supplyStartRefundMonths: number;
  /** ②: 供給開始月を 1 か月目として、何か月目の末日までの終了が戻入対象か */
  earlyTerminationMonths: number;
}

/** エバーグリーン MPプランの既定値（条件表どおり）。 */
export const DEFAULT_CLAWBACK_POLICY: ClawbackPolicy = {
  supplyStartDeadlineMonths: 3,
  supplyStartRefundMonths: 4,
  earlyTerminationMonths: 6,
};

/** 月末日を返す（時刻は 23:59:59.999）。 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * 「基準月を 1 か月目として N か月目の末日」を返す。
 * 例: 基準 2026-09-15 / N=3 → 2026-11-30
 */
export function nthMonthEnd(base: Date, n: number): Date {
  return endOfMonth(new Date(base.getFullYear(), base.getMonth() + (n - 1), 1));
}

export type ClawbackRiskState = 'NOT_APPLICABLE' | 'AT_RISK' | 'CONFIRMED' | 'RELEASED';

export interface ClawbackRisk {
  reason: ClawbackReason;
  state: ClawbackRiskState;
  /** この日までに条件を満たさなければ戻入が確定する */
  riskUntil: Date | null;
  /** 返還期限（確定した場合） */
  refundDueOn: Date | null;
  description: string;
}

export interface ContractClawbackInput {
  /** 申込データ投入完了日（取込日 or 申込日） */
  appliedAt: Date | null;
  /** 供給開始日 */
  activatedAt: Date | null;
  /** 解約日 */
  cancelledAt: Date | null;
  /** 契約ステータスがキャンセル扱いか */
  isCancelled: boolean;
  /** 提出資料に不正・虚偽が確認されたか（手動フラグ） */
  fraudulentDocument?: boolean;
}

/**
 * 1 契約の戻入リスクを評価する。
 *
 * - `AT_RISK`   … 期限内でまだ確定していない（粗利の引当対象）
 * - `CONFIRMED` … 戻入が確定した
 * - `RELEASED`  … 期限を過ぎ、戻入リスクが消滅した
 */
export function evaluateClawbackRisk(
  contract: ContractClawbackInput,
  now: Date = new Date(),
  policy: ClawbackPolicy = DEFAULT_CLAWBACK_POLICY,
): ClawbackRisk[] {
  const risks: ClawbackRisk[] = [];

  // ── ① 供給開始に至らなかった場合 ──
  if (contract.appliedAt) {
    const deadline = nthMonthEnd(contract.appliedAt, policy.supplyStartDeadlineMonths);
    const refundDue = nthMonthEnd(contract.appliedAt, policy.supplyStartRefundMonths);

    if (contract.activatedAt && contract.activatedAt <= deadline) {
      risks.push({
        reason: 'NO_SUPPLY_START',
        state: 'RELEASED',
        riskUntil: deadline,
        refundDueOn: null,
        description: '期限内に供給開始したため、戻入リスクは解消しています。',
      });
    } else if (now > deadline) {
      risks.push({
        reason: 'NO_SUPPLY_START',
        state: 'CONFIRMED',
        riskUntil: deadline,
        refundDueOn: refundDue,
        description: `${formatDate(deadline)} までに供給開始に至らなかったため、戻入が確定しています。`,
      });
    } else {
      risks.push({
        reason: 'NO_SUPPLY_START',
        state: 'AT_RISK',
        riskUntil: deadline,
        refundDueOn: refundDue,
        description: `${formatDate(deadline)} までに供給開始しなければ戻入対象になります。`,
      });
    }
  }

  // ── ② 短期解約・プラン変更の場合 ──
  if (contract.activatedAt) {
    const deadline = nthMonthEnd(contract.activatedAt, policy.earlyTerminationMonths);
    const terminatedEarly =
      contract.isCancelled && contract.cancelledAt !== null && contract.cancelledAt <= deadline;

    if (terminatedEarly) {
      risks.push({
        reason: 'EARLY_TERMINATION',
        state: 'CONFIRMED',
        riskUntil: deadline,
        refundDueOn: deadline,
        description: `供給開始から ${policy.earlyTerminationMonths} か月以内に契約終了したため、戻入が確定しています。`,
      });
    } else if (now > deadline) {
      risks.push({
        reason: 'EARLY_TERMINATION',
        state: 'RELEASED',
        riskUntil: deadline,
        refundDueOn: null,
        description: '短期解約の期間を経過したため、戻入リスクは解消しています。',
      });
    } else {
      risks.push({
        reason: 'EARLY_TERMINATION',
        state: 'AT_RISK',
        riskUntil: deadline,
        refundDueOn: deadline,
        description: `${formatDate(deadline)} までに契約終了すると戻入対象になります。`,
      });
    }
  }

  // ── ③ 提出資料の不正・虚偽 ──
  if (contract.fraudulentDocument) {
    risks.push({
      reason: 'FRAUDULENT_DOCUMENT',
      state: 'CONFIRMED',
      riskUntil: null,
      refundDueOn: null,
      description: '提出資料に不正・虚偽が確認されたため、全額返還の対象です（別途損害賠償の請求対象）。',
    });
  }

  return risks;
}

/** 契約単位で「いま戻入リスクを抱えているか」を 1 つに要約する。 */
export function summarizeClawback(risks: readonly ClawbackRisk[]): ClawbackRiskState {
  if (risks.some((r) => r.state === 'CONFIRMED')) return 'CONFIRMED';
  if (risks.some((r) => r.state === 'AT_RISK')) return 'AT_RISK';
  if (risks.length === 0) return 'NOT_APPLICABLE';
  return 'RELEASED';
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
