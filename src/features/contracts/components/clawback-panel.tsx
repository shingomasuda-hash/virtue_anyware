import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import type { ClawbackRisk, ClawbackRiskState } from '@/server/services/pricing/clawback';

const REASON_LABEL: Record<string, string> = {
  NO_SUPPLY_START: '① 供給開始に至らなかった場合',
  EARLY_TERMINATION: '② 短期解約・プラン変更の場合',
  FRAUDULENT_DOCUMENT: '③ 提出資料の不正・虚偽があった場合',
  OTHER: 'その他',
};

const STATE_META: Record<ClawbackRiskState, { label: string; tone: BadgeTone }> = {
  NOT_APPLICABLE: { label: '対象外', tone: 'neutral' },
  AT_RISK: { label: 'リスク保有', tone: 'warning' },
  CONFIRMED: { label: '戻入確定', tone: 'negative' },
  RELEASED: { label: 'リスク解消', tone: 'positive' },
};

/**
 * 戻入（クローバック）状況。条件表の「戻入条件」を契約単位で可視化する。
 * 期限内の案件は「リスク保有」として、粗利が確定していないことを明示する。
 */
export function ClawbackPanel({ risks }: { risks: ClawbackRisk[] }) {
  if (risks.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title="戻入（クローバック）状況"
        description="条件を満たさない場合、支払済みの成約事務手数料を返還する必要があります。"
      />
      <PanelBody>
        <ul className="flex flex-col gap-2.5 text-[13px]">
          {risks.map((risk) => {
            const meta = STATE_META[risk.state];
            return (
              <li
                key={risk.reason}
                className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-2.5 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{REASON_LABEL[risk.reason] ?? risk.reason}</span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="text-[12px] text-[var(--color-ink-muted)]">{risk.description}</p>
                {risk.riskUntil || risk.refundDueOn ? (
                  <p className="num text-[11px] text-[var(--color-ink-subtle)]">
                    {risk.riskUntil ? `判定期限 ${formatDate(risk.riskUntil)}` : ''}
                    {risk.riskUntil && risk.refundDueOn ? ' · ' : ''}
                    {risk.refundDueOn ? `返還期限 ${formatDate(risk.refundDueOn)}` : ''}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </PanelBody>
    </Panel>
  );
}
