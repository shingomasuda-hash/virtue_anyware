import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TierTable } from '@/features/pricing/components/tier-table';
import { SeasonalTable } from '@/features/pricing/components/seasonal-table';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { getAgencyUnitPrices, getPricingOverview } from '@/server/services/pricing/overview';
import { formatDate, formatNumber, formatPercent, formatYen } from '@/lib/format';
import { toNumber } from '@/lib/money';

const UNIT_TYPE_LABEL: Record<string, string> = {
  PER_WATT: '円/W',
  PER_CONTRACT: '円/件',
  PERCENT_OF_AMOUNT: '販売額比率',
  FIXED: '定額',
  TIERED_BY_USAGE: '階段表（想定使用量）',
  MARKUP_ON_PAYOUT: '代理店手数料への上乗せ',
};

/**
 * 単価マスタ（§6）。
 * 単価はコードに書かず、すべてここから解決される。
 * 条件表が改定されたら新しい適用期間の行を足す運用にする（過去契約は影響を受けない）。
 */
export default async function PricingMasterPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'pricing:read');

  const [{ rules, seasonalGroups }, agencyPrices] = await Promise.all([
    getPricingOverview(ctx),
    getAgencyUnitPrices(ctx),
  ]);

  const tieredRules = rules.filter((r) => r.tiers.length > 0);
  const normalRules = rules.filter((r) => !r.isFeePolicy);
  const feePolicies = rules.filter((r) => r.isFeePolicy);

  return (
    <>
      <PageHeader
        title="単価マスタ"
        description="単価はコードに一切書かれておらず、すべてこのマスタから解決されます。契約金額は契約日時点の単価でスナップショット保存されるため、ここを改定しても過去契約の数字は変わりません。"
      />

      <Panel>
        <PanelHeader
          title={`単価ルール（${normalRules.length} 件）`}
          description="より具体的なルール（代理店・商材・供給元・プランの一致数が多いもの）が優先されます。"
        />
        <TableWrap>
          <Table className="min-w-[1080px]">
            <thead>
              <tr>
                <Th>区分</Th>
                <Th>算定方式</Th>
                <Th align="right">単価 / 率</Th>
                <Th>供給元 / プラン</Th>
                <Th>代理店</Th>
                <Th>商材</Th>
                <Th>適用期間</Th>
                <Th>備考</Th>
              </tr>
            </thead>
            <tbody>
              {normalRules.length === 0 ? (
                <EmptyRow colSpan={8} message="単価ルールが登録されていません。" />
              ) : (
                normalRules.map((rule) => (
                  <Tr key={rule.id}>
                    <Td>
                      <Badge tone={rule.side === 'HQ_RECEIVE' ? 'brand' : 'neutral'}>
                        {rule.side === 'HQ_RECEIVE' ? '本部受取' : '代理店支払'}
                      </Badge>
                    </Td>
                    <Td>{UNIT_TYPE_LABEL[rule.unitType] ?? rule.unitType}</Td>
                    <Td numeric>
                      {rule.unitType === 'MARKUP_ON_PAYOUT' || rule.unitType === 'PERCENT_OF_AMOUNT'
                        ? `+${formatPercent(rule.rate ?? 0)}`
                        : rule.unitType === 'TIERED_BY_USAGE'
                          ? `${rule.tiers.length} 段`
                          : formatNumber(rule.unitPrice)}
                    </Td>
                    <Td className="text-[var(--color-ink-muted)]">
                      {[rule.supplierName, rule.planName].filter(Boolean).join(' / ') || '全供給元'}
                    </Td>
                    <Td className="text-[var(--color-ink-muted)]">{rule.agencyName ?? '全代理店'}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{rule.productName ?? '全商材'}</Td>
                    <Td className="num whitespace-nowrap text-[12px]">
                      {formatDate(rule.effectiveFrom)} 〜 {rule.effectiveTo ? formatDate(rule.effectiveTo) : '（現行）'}
                    </Td>
                    <Td className="max-w-[260px] truncate text-[12px] text-[var(--color-ink-subtle)]">
                      {rule.note ?? '—'}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      {tieredRules.map((rule) => (
        <Panel key={rule.id}>
          <PanelHeader
            title="成約事務手数料 対照表"
            description={`${[rule.supplierName, rule.planName].filter(Boolean).join(' ') || '全供給元'} / 適用 ${formatDate(rule.effectiveFrom)}${rule.effectiveTo ? ` 〜 ${formatDate(rule.effectiveTo)}` : ' 〜（現行）'}`}
          />
          <TierTable tiers={rule.tiers} issues={rule.tierIssues} />
        </Panel>
      ))}

      {seasonalGroups.map((group, index) => (
        <Panel key={index}>
          <PanelHeader title="季節係数表" />
          <SeasonalTable group={group} />
        </Panel>
      ))}

      {feePolicies.length > 0 ? (
        <Panel>
          <PanelHeader
            title="条件表の但し書き"
            description="明細の写真がない場合の定額手数料・マッチング確認案件の業務管理費。これらもコードではなくマスタで管理します。"
          />
          <TableWrap>
            <Table className="min-w-[640px]">
              <thead>
                <tr>
                  <Th>項目</Th>
                  <Th align="right">金額（税抜）</Th>
                  <Th>供給元</Th>
                  <Th>適用開始</Th>
                </tr>
              </thead>
              <tbody>
                {feePolicies.map((rule) => (
                  <Tr key={rule.id}>
                    <Td>
                      {rule.note === 'FEE_NO_STATEMENT'
                        ? '明細の写真がない場合の手数料（/地点）'
                        : 'マッチング確認案件の業務管理費（/地点・手数料と相殺）'}
                    </Td>
                    <Td numeric>{formatYen(rule.unitPrice)}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{rule.supplierName ?? '全供給元'}</Td>
                    <Td className="num">{formatDate(rule.effectiveFrom)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title={`代理店別単価（${agencyPrices.length} 件）`}
          description="代理店マスタ側の単価履歴。ここに登録があれば単価ルールより優先されます。"
        />
        <TableWrap>
          <Table className="min-w-[760px]">
            <thead>
              <tr>
                <Th>代理店</Th>
                <Th>商材</Th>
                <Th>算定方式</Th>
                <Th align="right">単価</Th>
                <Th>適用期間</Th>
                <Th>備考</Th>
              </tr>
            </thead>
            <tbody>
              {agencyPrices.length === 0 ? (
                <EmptyRow colSpan={6} message="代理店別単価は登録されていません。" />
              ) : (
                agencyPrices.map((price) => (
                  <Tr key={price.id}>
                    <Td>
                      {price.agency.name}
                      <span className="ml-1.5 text-[11px] text-[var(--color-ink-subtle)]">{price.agency.code}</span>
                    </Td>
                    <Td className="text-[var(--color-ink-muted)]">{price.product?.name ?? '全商材'}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{UNIT_TYPE_LABEL[price.unitType] ?? price.unitType}</Td>
                    <Td numeric>{formatNumber(toNumber(price.unitPrice))}</Td>
                    <Td className="num whitespace-nowrap text-[12px]">
                      {formatDate(price.effectiveFrom)} 〜 {price.effectiveTo ? formatDate(price.effectiveTo) : '（現行）'}
                    </Td>
                    <Td className="text-[12px] text-[var(--color-ink-subtle)]">{price.note ?? '—'}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
        <PanelBody className="pt-0">
          <p className="text-[11px] text-[var(--color-ink-subtle)]">
            単価の追加は各代理店の詳細画面から行います（適用期間が重なる既存単価は自動的に前日で締められます）。
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
