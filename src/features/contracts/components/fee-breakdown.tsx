import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { formatInt, formatNumber, formatPercent, formatYen } from '@/lib/format';

export interface FeeBreakdownProps {
  actualUsageKwh: number | null;
  usageMonth: number | null;
  seasonalCoefficient: number | null;
  estimatedUsageKwh: number | null;
  hasStatement: boolean;
  isMatchingConfirmed: boolean;
  agencyUnitType: string | null;
  tier: { minValue: number; maxValue: number | null; amount: number } | null;
  deduction: number;
  agencyPayout: number;
  /** 本部情報は権限がある場合のみ渡される */
  hqRevenue?: number;
  hqGrossProfit?: number;
  grossMargin?: number;
  markupRate?: number | null;
}

/**
 * 手数料の算定根拠を段階表示する。
 *
 *   明細の使用量 → 季節係数 → 想定使用量 → 階段表 → 代理店手数料 → 控除 → 支払額
 *   （本部権限があれば）→ 上乗せ率 → 本部受取 → 粗利
 *
 * 「なぜこの金額になったか」を画面上で追えるようにするのが目的。
 */
export function FeeBreakdown(props: FeeBreakdownProps) {
  const usesTier = props.agencyUnitType === 'TIERED_BY_USAGE' || props.tier !== null;
  if (!usesTier && props.actualUsageKwh === null) return null;

  return (
    <Panel>
      <PanelHeader
        title="手数料の算定根拠"
        description="契約日時点の条件表にもとづく計算過程。金額は契約行にスナップショット保存されています。"
      />
      <PanelBody>
        <ol className="flex flex-col gap-2 text-[13px]">
          <Step
            index={1}
            label="電気料金明細の使用量"
            value={props.actualUsageKwh === null ? '未入力' : `${formatNumber(props.actualUsageKwh)} kWh`}
            note={props.usageMonth ? `${props.usageMonth}月検針` : '検針月が未設定'}
          />
          <Step
            index={2}
            label="季節係数"
            value={props.seasonalCoefficient === null ? '—' : formatPercent(props.seasonalCoefficient)}
            note={props.usageMonth ? `${props.usageMonth}月の係数を適用` : '係数が特定できないため 100% で計算'}
          />
          <Step
            index={3}
            label="想定使用量"
            value={props.estimatedUsageKwh === null ? '—' : `${formatNumber(props.estimatedUsageKwh)} kWh`}
            note="使用量 × 季節係数"
            emphasis
          />
          <Step
            index={4}
            label="対照表の該当区分"
            value={
              props.tier === null
                ? props.hasStatement
                  ? '該当なし'
                  : '明細なしのため定額'
                : props.tier.maxValue === null
                  ? `${formatInt(props.tier.minValue)}以上`
                  : `${formatInt(props.tier.minValue)}以上${formatInt(props.tier.maxValue)}未満`
            }
            note={props.tier === null ? undefined : `${formatYen(props.tier.amount)}（税抜）`}
          />
          {!props.hasStatement ? (
            <li className="rounded-[var(--radius-sm)] border border-[#fedf89] bg-[var(--color-warning-soft)] px-3 py-2 text-[12px] text-[var(--color-warning)]">
              電気料金明細の提出がないため、対照表ではなく定額手数料が適用されています。
            </li>
          ) : null}
          {props.deduction > 0 ? (
            <Step
              index={5}
              label="業務管理費の相殺"
              value={`− ${formatYen(props.deduction)}`}
              note="マッチング確認案件のため手数料と相殺"
            />
          ) : null}
          <Step
            index={props.deduction > 0 ? 6 : 5}
            label="代理店への支払額"
            value={formatYen(props.agencyPayout)}
            emphasis
          />
          {props.hqRevenue !== undefined ? (
            <>
              <Step
                index={props.deduction > 0 ? 7 : 6}
                label="VIRTUE 受取額"
                value={formatYen(props.hqRevenue)}
                note={
                  props.markupRate !== null && props.markupRate !== undefined
                    ? `代理店手数料 + ${formatPercent(props.markupRate)}`
                    : undefined
                }
              />
              <Step
                index={props.deduction > 0 ? 8 : 7}
                label="VIRTUE 粗利"
                value={formatYen(props.hqGrossProfit ?? 0)}
                note={`粗利率 ${formatPercent(props.grossMargin ?? 0)}`}
                emphasis
              />
            </>
          ) : null}
        </ol>

        {props.isMatchingConfirmed ? (
          <p className="mt-3 text-[11px] text-[var(--color-ink-subtle)]">
            <Badge tone="neutral">マッチング確認案件</Badge>
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function Step({
  index,
  label,
  value,
  note,
  emphasis = false,
}: {
  index: number;
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[10px] text-[var(--color-ink-subtle)]">
          {index}
        </span>
        <div className="min-w-0">
          <p className={emphasis ? 'font-medium' : 'text-[var(--color-ink-muted)]'}>{label}</p>
          {note ? <p className="text-[11px] text-[var(--color-ink-subtle)]">{note}</p> : null}
        </div>
      </div>
      <span className={`num shrink-0 ${emphasis ? 'text-[15px] font-semibold' : ''}`}>{value}</span>
    </li>
  );
}
