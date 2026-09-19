import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLAWBACK_POLICY,
  evaluateClawbackRisk,
  nthMonthEnd,
  summarizeClawback,
  type ContractClawbackInput,
} from '@/server/services/pricing/clawback';

function contract(overrides: Partial<ContractClawbackInput> = {}): ContractClawbackInput {
  return {
    appliedAt: new Date(2026, 8, 15), // 2026-09-15
    activatedAt: null,
    cancelledAt: null,
    isCancelled: false,
    ...overrides,
  };
}

function risk(risks: ReturnType<typeof evaluateClawbackRisk>, reason: string) {
  return risks.find((r) => r.reason === reason);
}

describe('期限の計算', () => {
  it('基準月を 1 か月目として N か月目の末日を返す', () => {
    // 2026-09-15 を 1 か月目 → 3 か月目 = 2026-11 の末日
    expect(nthMonthEnd(new Date(2026, 8, 15), 3).toISOString().slice(0, 10)).toBe('2026-11-30');
    // 4 か月目 = 2026-12-31
    expect(nthMonthEnd(new Date(2026, 8, 15), 4).toISOString().slice(0, 10)).toBe('2026-12-31');
    // 年をまたぐ: 2026-11 を 1 か月目 → 3 か月目 = 2027-01-31
    expect(nthMonthEnd(new Date(2026, 10, 1), 3).toISOString().slice(0, 10)).toBe('2027-01-31');
  });

  it('うるう年の 2 月も正しく扱う', () => {
    expect(nthMonthEnd(new Date(2028, 1, 10), 1).toISOString().slice(0, 10)).toBe('2028-02-29');
  });
});

describe('① 供給開始に至らなかった場合', () => {
  it('期限内はリスク保有（AT_RISK）として扱う', () => {
    const risks = evaluateClawbackRisk(contract(), new Date(2026, 9, 1));
    const r = risk(risks, 'NO_SUPPLY_START');
    expect(r?.state).toBe('AT_RISK');
    expect(r?.riskUntil?.toISOString().slice(0, 10)).toBe('2026-11-30');
    expect(r?.refundDueOn?.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('3 か月目の末日までに供給開始すればリスクは解消する', () => {
    const risks = evaluateClawbackRisk(
      contract({ activatedAt: new Date(2026, 10, 30) }),
      new Date(2026, 11, 15),
    );
    expect(risk(risks, 'NO_SUPPLY_START')?.state).toBe('RELEASED');
  });

  it('3 か月目の末日を過ぎても供給開始しなければ戻入が確定する', () => {
    const risks = evaluateClawbackRisk(contract(), new Date(2026, 11, 1));
    const r = risk(risks, 'NO_SUPPLY_START');
    expect(r?.state).toBe('CONFIRMED');
    expect(r?.refundDueOn?.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('期限を 1 日過ぎた供給開始は戻入対象になる', () => {
    const risks = evaluateClawbackRisk(
      contract({ activatedAt: new Date(2026, 11, 1) }), // 2026-12-01（期限は 11-30）
      new Date(2026, 11, 2),
    );
    expect(risk(risks, 'NO_SUPPLY_START')?.state).toBe('CONFIRMED');
  });
});

describe('② 短期解約・プラン変更の場合', () => {
  it('供給開始から 6 か月目の末日までは戻入リスクを保有する', () => {
    // 供給開始 2026-10-05 → 6 か月目 = 2027-03-31
    const risks = evaluateClawbackRisk(
      contract({ activatedAt: new Date(2026, 9, 5) }),
      new Date(2026, 11, 1),
    );
    const r = risk(risks, 'EARLY_TERMINATION');
    expect(r?.state).toBe('AT_RISK');
    expect(r?.riskUntil?.toISOString().slice(0, 10)).toBe('2027-03-31');
  });

  it('6 か月以内の解約は戻入が確定する', () => {
    const risks = evaluateClawbackRisk(
      contract({
        activatedAt: new Date(2026, 9, 5),
        cancelledAt: new Date(2027, 0, 20),
        isCancelled: true,
      }),
      new Date(2027, 0, 25),
    );
    expect(risk(risks, 'EARLY_TERMINATION')?.state).toBe('CONFIRMED');
  });

  it('6 か月を過ぎればリスクは解消する', () => {
    const risks = evaluateClawbackRisk(
      contract({ activatedAt: new Date(2026, 9, 5) }),
      new Date(2027, 4, 1),
    );
    expect(risk(risks, 'EARLY_TERMINATION')?.state).toBe('RELEASED');
  });

  it('6 か月経過後の解約は戻入対象にならない', () => {
    const risks = evaluateClawbackRisk(
      contract({
        activatedAt: new Date(2026, 9, 5),
        cancelledAt: new Date(2027, 5, 1), // 期限 2027-03-31 を過ぎている
        isCancelled: true,
      }),
      new Date(2027, 5, 2),
    );
    expect(risk(risks, 'EARLY_TERMINATION')?.state).toBe('RELEASED');
  });
});

describe('③ 提出資料の不正・虚偽', () => {
  it('期限に関係なく戻入が確定する', () => {
    const risks = evaluateClawbackRisk(
      contract({ activatedAt: new Date(2020, 0, 1), fraudulentDocument: true }),
      new Date(2027, 0, 1),
    );
    const r = risk(risks, 'FRAUDULENT_DOCUMENT');
    expect(r?.state).toBe('CONFIRMED');
    expect(r?.description).toContain('損害賠償');
  });
});

describe('契約単位の要約', () => {
  it('1 つでも確定があれば CONFIRMED', () => {
    const risks = evaluateClawbackRisk(contract(), new Date(2026, 11, 1));
    expect(summarizeClawback(risks)).toBe('CONFIRMED');
  });

  it('確定が無くリスク保有中なら AT_RISK', () => {
    const risks = evaluateClawbackRisk(
      contract({ activatedAt: new Date(2026, 9, 5) }),
      new Date(2026, 10, 1),
    );
    expect(summarizeClawback(risks)).toBe('AT_RISK');
  });

  it('すべて期限経過なら RELEASED', () => {
    const risks = evaluateClawbackRisk(
      contract({ appliedAt: new Date(2026, 0, 10), activatedAt: new Date(2026, 1, 1) }),
      new Date(2027, 6, 1),
    );
    expect(summarizeClawback(risks)).toBe('RELEASED');
  });

  it('申込日も供給開始日も無ければ判定対象外', () => {
    expect(summarizeClawback(evaluateClawbackRisk(contract({ appliedAt: null })))).toBe('NOT_APPLICABLE');
  });
});

describe('ポリシーの既定値は条件表どおり', () => {
  it('3 か月 / 4 か月 / 6 か月', () => {
    expect(DEFAULT_CLAWBACK_POLICY.supplyStartDeadlineMonths).toBe(3);
    expect(DEFAULT_CLAWBACK_POLICY.supplyStartRefundMonths).toBe(4);
    expect(DEFAULT_CLAWBACK_POLICY.earlyTerminationMonths).toBe(6);
  });
});
