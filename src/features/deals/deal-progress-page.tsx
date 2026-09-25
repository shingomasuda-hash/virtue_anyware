import { notFound } from 'next/navigation';
import type { AccessContext } from '@/server/authz/context';
import { findDealById } from '@/server/services/deals/repo';
import { ProgressForm } from './components/progress-form';
import { toDateInput } from './deal-form-page';

export async function DealProgressPage({
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
  const p = deal.progress;

  return (
    <ProgressForm
      dealId={deal.id}
      dealCode={`${deal.code}　${deal.customer.name}`}
      basePath={basePath}
      defaults={{
        loanReview: p?.loanReview,
        siteSurvey: p?.siteSurvey,
        siteSurveyAt: toDateInput(p?.siteSurveyAt),
        subsidy: p?.subsidy,
        subsidyProgram: p?.subsidyProgram,
        subsidyAppliedAt: toDateInput(p?.subsidyAppliedAt),
        subsidyApprovedAt: toDateInput(p?.subsidyApprovedAt),
        construction: p?.construction,
        constructionScheduledAt: toDateInput(p?.constructionScheduledAt),
        constructionCompletedAt: toDateInput(p?.constructionCompletedAt),
        completionCheck: p?.completionCheck,
        paymentDueAt: toDateInput(p?.paymentDueAt),
        paidAt: toDateInput(p?.paidAt),
        paymentStatus: p?.paymentStatus,
        contractDocument: p?.contractDocument,
        importantMatters: p?.importantMatters,
        warranty: p?.warranty,
        sitePhotos: p?.sitePhotos,
        gridConnection: p?.gridConnection,
        attention: p?.attention,
      }}
    />
  );
}
