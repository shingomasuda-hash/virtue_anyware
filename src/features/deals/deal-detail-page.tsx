import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { can, type AccessContext } from '@/server/authz/context';
import { findDealById, findDealCompensation } from '@/server/services/deals/repo';
import { formatDate, formatDateTime, formatPercent, formatYen } from '@/lib/format';
import { DefinitionList, DefinitionRow } from './components/definition-list';
import {
  CONSTRUCTION_LABELS,
  COMPENSATION_PAYMENT_STATUS_LABELS,
  DEAL_PAYMENT_STATUS_LABELS,
  DEAL_PRIORITY_LABELS,
  DEAL_PRODUCT_TYPE_LABELS,
  LOAN_REVIEW_LABELS,
  PAYMENT_METHOD_LABELS,
  PROGRESS_LABELS,
  SITE_SURVEY_LABELS,
  SUBSIDY_LABELS,
  isSettled,
} from './labels';

const ACTIVITY_LABELS = {
  STATUS_CHANGE: 'ステータス変更',
  MEMO: 'メモ',
  VISIT: '訪問',
  CALL: '架電',
  PROGRESS_UPDATE: '進捗更新',
} as const;

export async function DealDetailPage({
  ctx,
  id,
  basePath,
  customerBasePath,
}: {
  ctx: AccessContext;
  id: string;
  basePath: string;
  customerBasePath: string;
}) {
  const deal = await findDealById(ctx, id);
  if (!deal) notFound();

  const showCompensation = can(ctx, 'deal:compensation');
  const compensation = showCompensation ? await findDealCompensation(ctx, id) : null;
  const progress = deal.progress;

  return (
    <>
      <PageHeader
        title={`${deal.code}　${deal.customer.name}`}
        description={[deal.agency?.name ?? '自社直販', deal.closer ? `営業 ${deal.closer.name}` : null]
          .filter(Boolean)
          .join(' / ')}
        actions={
          <div className="flex items-center gap-2">
            {can(ctx, 'deal:progress') ? (
              <Button asChild variant="secondary" size="md">
                <Link href={`${basePath}/${deal.id}/progress`}>進捗を更新</Link>
              </Button>
            ) : null}
            {showCompensation ? (
              <Button asChild variant="secondary" size="md">
                <Link href={`${basePath}/${deal.id}/compensation`}>報酬を入力</Link>
              </Button>
            ) : null}
            {can(ctx, 'deal:write') ? (
              <Button asChild variant="primary" size="md">
                <Link href={`${basePath}/${deal.id}/edit`}>編集</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <Panel>
        <PanelHeader
          title="案件概要"
          actions={<Badge tone={toneFromColor(deal.status.color)}>{deal.status.label}</Badge>}
        />
        <PanelBody className="flex flex-col gap-4">
          <DefinitionList>
            <DefinitionRow label="顧客">
              <Link href={`${customerBasePath}/${deal.customerId}`} className="text-[var(--color-brand)] hover:underline">
                {deal.customer.name}
              </Link>
            </DefinitionRow>
            <DefinitionRow label="電話番号">{deal.customer.phone ?? '—'}</DefinitionRow>
            <DefinitionRow label="都道府県">{deal.customer.prefecture ?? '—'}</DefinitionRow>
            <DefinitionRow label="優先度">{DEAL_PRIORITY_LABELS[deal.priority]}</DefinitionRow>

            <DefinitionRow label="商材">
              {deal.productTypes.length === 0
                ? '—'
                : deal.productTypes.map((t) => DEAL_PRODUCT_TYPE_LABELS[t]).join('・')}
            </DefinitionRow>
            <DefinitionRow label="太陽光">
              {deal.pvManufacturer
                ? `${deal.pvManufacturer.name}${deal.pvCapacityKw ? ` / ${Number(deal.pvCapacityKw)} kW` : ''}`
                : '—'}
            </DefinitionRow>
            <DefinitionRow label="蓄電池">
              {deal.batteryManufacturer
                ? `${deal.batteryManufacturer.name}${deal.batteryModel ? ` / ${deal.batteryModel.name}` : ''}${deal.batteryCapacityKwh ? ` / ${Number(deal.batteryCapacityKwh)} kWh` : ''}`
                : '—'}
            </DefinitionRow>
            <DefinitionRow label="設備（EQ）">{deal.equipmentManufacturer?.name ?? '—'}</DefinitionRow>

            <DefinitionRow label="商談日">{formatDate(deal.metAt)}</DefinitionRow>
            <DefinitionRow label="契約日">{formatDate(deal.contractedAt)}</DefinitionRow>
            <DefinitionRow label="販売価格（税抜）">
              {deal.salesPriceExclTax === null ? '—' : formatYen(Number(deal.salesPriceExclTax))}
            </DefinitionRow>
            <DefinitionRow label="支払方法 / 信販会社">
              {[deal.paymentMethod ? PAYMENT_METHOD_LABELS[deal.paymentMethod] : null, deal.financeCompany?.name]
                .filter(Boolean)
                .join(' / ') || '—'}
            </DefinitionRow>

            <DefinitionRow label="アポ担当（AP）">{deal.appointer?.name ?? '—'}</DefinitionRow>
            <DefinitionRow label="営業（CL）">{deal.closer?.name ?? '—'}</DefinitionRow>
            <DefinitionRow label="次回アクション日">{formatDate(deal.nextActionAt)}</DefinitionRow>
            <DefinitionRow label="失注理由" tone={deal.lostReason ? 'negative' : 'muted'}>
              {deal.lostReason ?? '—'}
            </DefinitionRow>
          </DefinitionList>

          {deal.notes ? (
            <div className="border-t border-[var(--color-border)] pt-3">
              <p className="text-[11px] text-[var(--color-ink-subtle)]">備考</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px]">{deal.notes}</p>
            </div>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="進捗" description={progress ? undefined : '契約後に入力します。'} />
        <PanelBody>
          {!progress ? (
            <p className="text-[13px] text-[var(--color-ink-subtle)]">進捗はまだ登録されていません。</p>
          ) : (
            <div className="flex flex-col gap-4">
              <DefinitionList>
                <DefinitionRow label="ローン審査">{LOAN_REVIEW_LABELS[progress.loanReview]}</DefinitionRow>
                <DefinitionRow label="現調">
                  {SITE_SURVEY_LABELS[progress.siteSurvey]}
                  {progress.siteSurveyAt ? `（${formatDate(progress.siteSurveyAt)}）` : ''}
                </DefinitionRow>
                <DefinitionRow label="補助金">
                  {SUBSIDY_LABELS[progress.subsidy]}
                  {progress.subsidyProgram ? `（${progress.subsidyProgram}）` : ''}
                </DefinitionRow>
                <DefinitionRow label="補助金 申請日 / 交付決定日">
                  {`${formatDate(progress.subsidyAppliedAt)} / ${formatDate(progress.subsidyApprovedAt)}`}
                </DefinitionRow>

                <DefinitionRow label="工事手配">{CONSTRUCTION_LABELS[progress.construction]}</DefinitionRow>
                <DefinitionRow label="工事 予定日 / 完了日">
                  {`${formatDate(progress.constructionScheduledAt)} / ${formatDate(progress.constructionCompletedAt)}`}
                </DefinitionRow>
                <DefinitionRow label="完工確認">{PROGRESS_LABELS[progress.completionCheck]}</DefinitionRow>
                <DefinitionRow label="系統連系" tone={isSettled(progress.gridConnection) ? 'default' : 'warning'}>
                  {PROGRESS_LABELS[progress.gridConnection]}
                </DefinitionRow>

                <DefinitionRow label="入金状況">{DEAL_PAYMENT_STATUS_LABELS[progress.paymentStatus]}</DefinitionRow>
                <DefinitionRow label="入金 予定日 / 入金日">
                  {`${formatDate(progress.paymentDueAt)} / ${formatDate(progress.paidAt)}`}
                </DefinitionRow>
                <DefinitionRow label="契約書 / 重要事項">
                  {`${PROGRESS_LABELS[progress.contractDocument]} / ${PROGRESS_LABELS[progress.importantMatters]}`}
                </DefinitionRow>
                <DefinitionRow label="保証書 / 施工写真">
                  {`${PROGRESS_LABELS[progress.warranty]} / ${PROGRESS_LABELS[progress.sitePhotos]}`}
                </DefinitionRow>
              </DefinitionList>

              {progress.attention ? (
                <div className="rounded-[var(--radius-sm)] border border-[#fedf89] bg-[var(--color-warning-soft)] px-3 py-2 text-[12px] text-[var(--color-warning)]">
                  {progress.attention}
                </div>
              ) : null}
            </div>
          )}
        </PanelBody>
      </Panel>

      {showCompensation ? (
        <Panel>
          <PanelHeader
            title="報酬"
            description="原価・営業利益・会社残粗利は本部のみ表示されます（§17）。金額はサーバー側で計算した結果です。"
          />
          <PanelBody>
            {!compensation ? (
              <p className="text-[13px] text-[var(--color-ink-subtle)]">報酬はまだ登録されていません。</p>
            ) : (
              <div className="flex flex-col gap-4">
                <DefinitionList>
                  <DefinitionRow label="設備費">{formatYen(Number(compensation.equipmentCost))}</DefinitionRow>
                  <DefinitionRow label="工事代">{formatYen(Number(compensation.constructionCost))}</DefinitionRow>
                  <DefinitionRow label="延長保証料">{formatYen(Number(compensation.extendedWarrantyCost))}</DefinitionRow>
                  <DefinitionRow label="その他原価">{formatYen(Number(compensation.otherCost))}</DefinitionRow>
                </DefinitionList>
                <DefinitionList>
                  <DefinitionRow label="原価合計">{formatYen(Number(compensation.totalCost))}</DefinitionRow>
                  <DefinitionRow
                    label="営業利益"
                    tone={Number(compensation.grossProfit) < 0 ? 'negative' : 'default'}
                  >
                    {formatYen(Number(compensation.grossProfit))}
                  </DefinitionRow>
                  <DefinitionRow label="控除額">{formatYen(Number(compensation.deductionAmount))}</DefinitionRow>
                  <DefinitionRow label="コミッション対象額" tone="muted">
                    {formatYen(Number(compensation.commissionBase))}
                  </DefinitionRow>
                </DefinitionList>
                <DefinitionList>
                  <DefinitionRow label={`営業コミッション（${formatPercent(Number(compensation.salesCommissionRate), 1)}）`}>
                    {formatYen(Number(compensation.salesCommission))}
                  </DefinitionRow>
                  <DefinitionRow label={`代理店コミッション（${formatPercent(Number(compensation.agencyCommissionRate), 1)}）`}>
                    {formatYen(Number(compensation.agencyCommission))}
                  </DefinitionRow>
                  <DefinitionRow
                    label="会社残粗利"
                    tone={Number(compensation.companyGrossProfit) < 0 ? 'negative' : 'default'}
                  >
                    {formatYen(Number(compensation.companyGrossProfit))}
                  </DefinitionRow>
                  <DefinitionRow label="支払状況">
                    {`${COMPENSATION_PAYMENT_STATUS_LABELS[compensation.paymentStatus]}（予定 ${formatDate(compensation.paymentDueAt)} / 実施 ${formatDate(compensation.paidAt)}）`}
                  </DefinitionRow>
                </DefinitionList>
              </div>
            )}
          </PanelBody>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="対応履歴" />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>日時</Th>
                <Th>種別</Th>
                <Th>担当</Th>
                <Th>内容</Th>
              </tr>
            </thead>
            <tbody>
              {deal.activities.length === 0 ? (
                <EmptyRow colSpan={4} message="履歴がありません。" />
              ) : (
                deal.activities.map((a) => (
                  <Tr key={a.id}>
                    <Td className="num whitespace-nowrap">{formatDateTime(a.occurredAt)}</Td>
                    <Td>{ACTIVITY_LABELS[a.type]}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{a.user?.name ?? '—'}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{a.memo ?? '—'}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>
    </>
  );
}
