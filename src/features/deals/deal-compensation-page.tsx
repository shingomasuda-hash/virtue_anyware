import { notFound } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import type { AccessContext } from '@/server/authz/context';
import { findDealById, findDealCompensation } from '@/server/services/deals/repo';
import { CompensationForm } from './components/compensation-form';
import { toDateInput } from './deal-form-page';

export async function DealCompensationPage({
  ctx,
  dealId,
  basePath,
}: {
  ctx: AccessContext;
  dealId: string;
  basePath: string;
}) {
  const deal = await findDealById(ctx, dealId);
  if (!deal) notFound();

  if (deal.salesPriceExclTax === null) {
    return (
      <Panel>
        <PanelHeader title={`${deal.code} の報酬`} />
        <PanelBody>
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            販売価格（税抜）が未入力のため報酬を計算できません。先に案件の販売価格を入力してください。
          </p>
        </PanelBody>
      </Panel>
    );
  }

  const c = await findDealCompensation(ctx, dealId);

  return (
    <CompensationForm
      dealId={deal.id}
      dealCode={`${deal.code}　${deal.customer.name}`}
      salesPriceExclTax={Number(deal.salesPriceExclTax)}
      basePath={basePath}
      defaults={{
        equipmentCost: c ? String(Number(c.equipmentCost)) : '0',
        constructionCost: c ? String(Number(c.constructionCost)) : '0',
        extendedWarrantyCost: c ? String(Number(c.extendedWarrantyCost)) : '0',
        otherCost: c ? String(Number(c.otherCost)) : '0',
        deductionAmount: c ? String(Number(c.deductionAmount)) : '0',
        salesCommissionRate: c ? String(Number(c.salesCommissionRate)) : '0',
        agencyCommissionRate: c ? String(Number(c.agencyCommissionRate)) : '0',
        paymentDueAt: toDateInput(c?.paymentDueAt),
        paidAt: toDateInput(c?.paidAt),
        paymentStatus: c?.paymentStatus,
        notes: c?.notes,
      }}
    />
  );
}
