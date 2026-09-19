import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { canViewHqFinancials, can, type AccessContext } from '@/server/authz/context';
import { findCustomerById } from '@/server/repositories/customer.repo';
import { formatDate, formatDateTime, formatPercent, formatWatt, formatYen } from '@/lib/format';
import { toNumber } from '@/lib/money';

/**
 * 顧客詳細（§12）:
 * 基本情報 → 電力契約 → 売上/精算 → 対応履歴 → 太陽光/蓄電池案件 → メモ
 * 1顧客に複数契約があるケースを前提にしている。
 */
export async function CustomerDetailPage({
  ctx,
  id,
  contractBasePath,
}: {
  ctx: AccessContext;
  id: string;
  contractBasePath: string;
}) {
  const customer = await findCustomerById(ctx, id);
  // スコープ外 ID は null。URL 直打ちでも他代理店の顧客は見えない。
  if (!customer) notFound();

  const showHq = canViewHqFinancials(ctx);
  const showUpsell = can(ctx, 'upsell:read');

  return (
    <>
      <PageHeader
        title={customer.name}
        description={[customer.nameKana, customer.agency?.name].filter(Boolean).join(' / ') || undefined}
      />

      {/* 1. 基本情報 */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="基本情報" />
          <PanelBody>
            <dl className="divide-y divide-[var(--color-border)] text-[13px]">
              <Row label="顧客ID（外部）" value={customer.externalCustomerId} />
              <Row label="電話番号" value={customer.phone} />
              <Row label="メール" value={customer.email} />
              <Row label="郵便番号" value={customer.postalCode} />
              <Row label="住所" value={[customer.prefecture, customer.city, customer.address, customer.building].filter(Boolean).join(' ')} />
              <Row label="生年月日" value={formatDate(customer.birthDate)} />
              <Row label="担当者" value={customer.assignedUser?.name ?? null} />
              <Row label="代理店" value={customer.agency?.name ?? null} />
              <Row label="獲得催事" value={customer.sourceEvent?.name ?? null} />
              <Row label="登録日" value={formatDateTime(customer.createdAt)} />
            </dl>
          </PanelBody>
        </Panel>

        {/* 6. メモ */}
        <Panel>
          <PanelHeader title="メモ" />
          <PanelBody>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--color-ink-muted)]">
              {customer.notes?.trim() ? customer.notes : 'メモはありません。'}
            </p>
          </PanelBody>
        </Panel>
      </div>

      {/* 2. 電力契約 */}
      <Panel>
        <PanelHeader title={`契約（${customer.contracts.length} 件）`} description="同一顧客の複数契約に対応しています。" />
        <TableWrap>
          <Table className="min-w-[860px]">
            <thead>
              <tr>
                <Th>契約番号</Th>
                <Th>商材</Th>
                <Th>電力会社 / プラン</Th>
                <Th align="right">契約W</Th>
                <Th>契約日</Th>
                <Th>開通日</Th>
                <Th>ステータス</Th>
              </tr>
            </thead>
            <tbody>
              {customer.contracts.length === 0 ? (
                <EmptyRow colSpan={7} message="契約がありません。" />
              ) : (
                customer.contracts.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`${contractBasePath}/${c.id}`} className="text-[var(--color-brand)] hover:underline">
                        {c.contractNumber ?? '（番号なし）'}
                      </Link>
                    </Td>
                    <Td>{c.product.name}</Td>
                    <Td className="text-[var(--color-ink-muted)]">
                      {[c.supplier?.name, c.plan?.name].filter(Boolean).join(' / ') || '—'}
                    </Td>
                    <Td numeric>{formatWatt(toNumber(c.contractWatt))}</Td>
                    <Td className="num">{formatDate(c.contractedAt)}</Td>
                    <Td className="num">{formatDate(c.activatedAt)}</Td>
                    <Td>
                      <Badge tone={toneFromColor(c.status.color)}>{c.status.label}</Badge>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      {/* 3. 売上 / 精算 */}
      <Panel>
        <PanelHeader
          title="売上 / 精算"
          description={showHq ? '契約時点の単価スナップショットに基づく金額' : '自社の支払予定額のみ表示しています。'}
        />
        <TableWrap>
          <Table className="min-w-[760px]">
            <thead>
              <tr>
                <Th>契約番号</Th>
                <Th align="right">契約W</Th>
                {showHq ? <Th align="right">本部単価</Th> : null}
                <Th align="right">代理店単価</Th>
                {showHq ? <Th align="right">VIRTUE売上</Th> : null}
                <Th align="right">代理店支払</Th>
                {showHq ? <Th align="right">粗利</Th> : null}
                {showHq ? <Th align="right">粗利率</Th> : null}
              </tr>
            </thead>
            <tbody>
              {customer.contracts.length === 0 ? (
                <EmptyRow colSpan={showHq ? 8 : 3} />
              ) : (
                customer.contracts.map((c) => (
                  <Tr key={c.id}>
                    <Td className="num">{c.contractNumber ?? '—'}</Td>
                    <Td numeric>{formatWatt(toNumber(c.contractWatt))}</Td>
                    {showHq ? <Td numeric>{formatYen(toNumber(c.hqUnitPrice))}</Td> : null}
                    <Td numeric>{formatYen(toNumber(c.agencyUnitPrice))}</Td>
                    {showHq ? <Td numeric>{formatYen(toNumber(c.hqRevenue))}</Td> : null}
                    <Td numeric>{formatYen(toNumber(c.agencyPayout))}</Td>
                    {showHq ? <Td numeric>{formatYen(toNumber(c.hqGrossProfit))}</Td> : null}
                    {showHq ? <Td numeric>{formatPercent(toNumber(c.grossMargin))}</Td> : null}
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* 4. 対応履歴 */}
        <Panel>
          <PanelHeader title="対応履歴" description="CSV登録・契約更新・架電・ステータス変更などを時系列で表示" />
          <PanelBody className="max-h-[420px] overflow-y-auto">
            {customer.activities.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-subtle)]">履歴がありません。</p>
            ) : (
              <ol className="relative border-l border-[var(--color-border)] pl-4">
                {customer.activities.map((a) => (
                  <li key={a.id} className="mb-4 last:mb-0">
                    <span className="absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
                    <p className="text-[12px] text-[var(--color-ink-subtle)]">
                      {formatDateTime(a.occurredAt)}
                      {a.actor ? ` · ${a.actor.name}` : ''}
                    </p>
                    <p className="text-[13px] font-medium">{a.title}</p>
                    {a.body ? <p className="text-[12px] text-[var(--color-ink-muted)]">{a.body}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </PanelBody>
        </Panel>

        {/* 5. 太陽光 / 蓄電池案件 */}
        <Panel>
          <PanelHeader title="太陽光 / 蓄電池案件" description={showUpsell ? 'アップセルCRMの進捗' : undefined} />
          <PanelBody>
            {!showUpsell ? (
              <p className="text-[13px] text-[var(--color-ink-subtle)]">この情報を閲覧する権限がありません。</p>
            ) : customer.upsellLeads.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-subtle)]">アップセル案件はありません。</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {customer.upsellLeads.map((lead) => (
                  <li key={lead.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{lead.product.name}</span>
                      <Badge tone={toneFromColor(lead.status.color)}>{lead.status.label}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--color-ink-subtle)]">
                      架電 {lead.callCount} 回
                      {lead.lastCalledAt ? ` · 最終架電 ${formatDate(lead.lastCalledAt)}` : ''}
                      {lead.nextActionAt ? ` · 次回 ${formatDate(lead.nextActionAt)}` : ''}
                      {lead.assignedUser ? ` · 担当 ${lead.assignedUser.name}` : ''}
                    </p>
                    {lead.tossups.length > 0 ? (
                      <p className="mt-1 text-[12px] text-[var(--color-ink-muted)]">
                        トスアップ先: {lead.tossups.map((t) => t.partner?.name ?? '未設定').join(', ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-right">{value && String(value).trim() !== '' ? value : '—'}</dd>
    </div>
  );
}
