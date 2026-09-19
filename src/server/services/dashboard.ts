import type { AccessContext } from '@/server/authz/context';
import { canViewHqFinancials, isAgencyScoped } from '@/server/authz/context';
import { prisma } from '@/server/db';
import { agencyScope } from '@/server/authz/scope';
import { monthKey, monthsBetween, type DateRange } from '@/lib/date';
import { safeDivide, toNumber } from '@/lib/money';
import { aggregateSalesKpi, withConversionRates, type ContractFact, type SalesKpi, type FunnelStepWithRate } from '@/server/services/kpi';
import { findContractFacts } from '@/server/repositories/contract.repo';

export interface MonthlyPoint {
  month: string;
  contracts: number;
  watt: number;
  hqRevenue: number;
  agencyPayout: number;
  hqGrossProfit: number;
}

export interface AgencyRankRow {
  agencyId: string;
  agencyCode: string;
  agencyName: string;
  contracts: number;
  watt: number;
  hqRevenue: number;
  agencyPayout: number;
  hqGrossProfit: number;
  cancellationRate: number;
  upsellCount: number;
}

export interface DashboardData {
  kpi: SalesKpi;
  monthly: MonthlyPoint[];
  agencyRanking: AgencyRankRow[];
  upsell: {
    targetCustomers: number;
    tossupCount: number;
    wonCount: number;
    upsellRate: number;
  };
  funnel: FunnelStepWithRate[];
  /** 代理店ユーザーには本部金額を返していないことを UI に伝える */
  showsHqFinancials: boolean;
}

interface FactRow {
  agencyId: string | null;
  contractedAt: Date | null;
  contractWatt: unknown;
  hqRevenue: unknown;
  agencyPayout: unknown;
  hqGrossProfit: unknown;
  activatedAt: Date | null;
  status: { isCancelled: boolean; isDefect: boolean; isActiveContract: boolean };
  agency: { id: string; name: string; code: string } | null;
}

function toFact(row: FactRow): ContractFact {
  return {
    isCancelled: row.status.isCancelled,
    isDefect: row.status.isDefect,
    isActivated: row.activatedAt !== null,
    watt: toNumber(row.contractWatt as never),
    hqRevenue: toNumber(row.hqRevenue as never),
    agencyPayout: toNumber(row.agencyPayout as never),
    hqGrossProfit: toNumber(row.hqGrossProfit as never),
  };
}

/**
 * ダッシュボードの数値は **すべて契約行のスナップショットから**集計する。
 * 単価マスタを後から変更しても過去の数字は動かない（§6）。
 */
export async function getDashboardData(ctx: AccessContext, range: DateRange): Promise<DashboardData> {
  const rows = (await findContractFacts(ctx, {
    contractedFrom: range.from,
    contractedTo: range.to,
  })) as unknown as FactRow[];

  const kpi = aggregateSalesKpi(rows.map(toFact));

  // ── 月別推移 ──
  const buckets = new Map<string, MonthlyPoint>();
  for (const key of monthsBetween(range.from, range.to)) {
    buckets.set(key, { month: key, contracts: 0, watt: 0, hqRevenue: 0, agencyPayout: 0, hqGrossProfit: 0 });
  }
  for (const row of rows) {
    if (row.status.isCancelled || !row.contractedAt) continue;
    const key = monthKey(row.contractedAt);
    const point = buckets.get(key) ?? { month: key, contracts: 0, watt: 0, hqRevenue: 0, agencyPayout: 0, hqGrossProfit: 0 };
    point.contracts += 1;
    point.watt += toNumber(row.contractWatt as never);
    point.hqRevenue += toNumber(row.hqRevenue as never);
    point.agencyPayout += toNumber(row.agencyPayout as never);
    point.hqGrossProfit += toNumber(row.hqGrossProfit as never);
    buckets.set(key, point);
  }
  const monthly = [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));

  // ── 代理店ランキング ──
  // 代理店ロールには他代理店の行を返さない（そもそも rows が自社に限定されている）
  const agencyMap = new Map<string, { row: AgencyRankRow; total: number; cancelled: number }>();
  for (const row of rows) {
    if (!row.agency) continue;
    const entry = agencyMap.get(row.agency.id) ?? {
      row: {
        agencyId: row.agency.id,
        agencyCode: row.agency.code,
        agencyName: row.agency.name,
        contracts: 0,
        watt: 0,
        hqRevenue: 0,
        agencyPayout: 0,
        hqGrossProfit: 0,
        cancellationRate: 0,
        upsellCount: 0,
      },
      total: 0,
      cancelled: 0,
    };
    entry.total += 1;
    if (row.status.isCancelled) {
      entry.cancelled += 1;
    } else {
      entry.row.contracts += 1;
      entry.row.watt += toNumber(row.contractWatt as never);
      entry.row.hqRevenue += toNumber(row.hqRevenue as never);
      entry.row.agencyPayout += toNumber(row.agencyPayout as never);
      entry.row.hqGrossProfit += toNumber(row.hqGrossProfit as never);
    }
    agencyMap.set(row.agency.id, entry);
  }
  const agencyRanking = [...agencyMap.values()]
    .map(({ row, total, cancelled }) => ({ ...row, cancellationRate: safeDivide(cancelled, total) }))
    .sort((a, b) => b.hqRevenue - a.hqRevenue || b.contracts - a.contracts);

  const upsell = await getUpsellSummary(ctx);

  return {
    kpi,
    monthly,
    agencyRanking,
    upsell: upsell.summary,
    funnel: upsell.funnel,
    showsHqFinancials: canViewHqFinancials(ctx),
  };
}

/** アップセルファネル（§23）。段階の定義は docs/KPI_DEFINITIONS.md に従う。 */
export async function getUpsellSummary(ctx: AccessContext) {
  const scope = agencyScope(ctx);
  // アップセルは本部商流。代理店ロールには集計を返さない。
  if (isAgencyScoped(ctx)) {
    return {
      summary: { targetCustomers: 0, tossupCount: 0, wonCount: 0, upsellRate: 0 },
      funnel: withConversionRates([]),
    };
  }

  const where = scope.organizationId ? { organizationId: scope.organizationId } : {};
  const [leads, tossups, contractCount] = await Promise.all([
    prisma.upsellLead.findMany({
      where,
      select: { id: true, callCount: true, status: { select: { funnelStage: true, isWon: true, isLost: true } } },
    }),
    prisma.tossup.count({ where }),
    prisma.contract.count({
      where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), deletedAt: null, status: { isCancelled: false } },
    }),
  ]);

  const active = leads.filter((l) => l.status.funnelStage !== 'EXCLUDED');
  const stageAtLeast = (stages: readonly string[]) => active.filter((l) => stages.includes(l.status.funnelStage)).length;

  const called = active.filter((l) => l.callCount > 0).length;
  const connected = stageAtLeast(['CONNECTED', 'INTERESTED', 'APPOINTMENT', 'TOSSUP', 'MEETING', 'WON']);
  const interested = stageAtLeast(['INTERESTED', 'APPOINTMENT', 'TOSSUP', 'MEETING', 'WON']);
  const appointment = stageAtLeast(['APPOINTMENT', 'TOSSUP', 'MEETING', 'WON']);
  const tossedUp = stageAtLeast(['TOSSUP', 'MEETING', 'WON']);
  const meeting = stageAtLeast(['MEETING', 'WON']);
  const won = active.filter((l) => l.status.isWon).length;

  return {
    summary: {
      targetCustomers: active.length,
      tossupCount: tossups,
      wonCount: won,
      upsellRate: safeDivide(won, active.length),
    },
    funnel: withConversionRates([
      { key: 'contract', label: '電力契約', count: contractCount },
      { key: 'target', label: 'アップセル対象', count: active.length },
      { key: 'called', label: '架電', count: called },
      { key: 'connected', label: '接続', count: connected },
      { key: 'interested', label: '興味あり', count: interested },
      { key: 'appointment', label: 'アポイント', count: appointment },
      { key: 'tossup', label: 'トスアップ', count: tossedUp },
      { key: 'meeting', label: '商談', count: meeting },
      { key: 'won', label: '成約', count: won },
    ]),
  };
}
