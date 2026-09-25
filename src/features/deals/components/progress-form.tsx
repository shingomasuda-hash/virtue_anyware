'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import {
  CONSTRUCTION_LABELS,
  DEAL_PAYMENT_STATUS_LABELS,
  LOAN_REVIEW_LABELS,
  PROGRESS_LABELS,
  SITE_SURVEY_LABELS,
  SUBSIDY_LABELS,
  optionsOf,
} from '../labels';
import { saveDealProgressAction } from '../actions';

export interface ProgressFormDefaults {
  loanReview?: string;
  siteSurvey?: string;
  siteSurveyAt?: string | null;
  subsidy?: string;
  subsidyProgram?: string | null;
  subsidyAppliedAt?: string | null;
  subsidyApprovedAt?: string | null;
  construction?: string;
  constructionScheduledAt?: string | null;
  constructionCompletedAt?: string | null;
  completionCheck?: string;
  paymentDueAt?: string | null;
  paidAt?: string | null;
  paymentStatus?: string;
  contractDocument?: string;
  importantMatters?: string;
  warranty?: string;
  sitePhotos?: string;
  gridConnection?: string;
  attention?: string | null;
}

type State = ActionResult<{ id: string }> | null;

function StateSelect({
  name,
  label,
  labels,
  value,
}: {
  name: string;
  label: string;
  labels: Record<string, string>;
  value: string | undefined;
}) {
  return (
    <Field label={label}>
      <Select name={name} required defaultValue={value ?? 'NOT_STARTED'}>
        {optionsOf(labels).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </Field>
  );
}

export function ProgressForm({
  dealId,
  dealCode,
  defaults,
  basePath,
}: {
  dealId: string;
  dealCode: string;
  defaults: ProgressFormDefaults;
  basePath: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<State, FormData>(
    async (prev, formData) => (await saveDealProgressAction(prev, formData)) as State,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push(`${basePath}/${dealId}`);
      router.refresh();
    }
  }, [state, router, basePath, dealId]);

  return (
    <form action={formAction}>
      <input type="hidden" name="dealId" value={dealId} />
      <Panel>
        <PanelHeader title={`${dealCode} の進捗を更新`} description="審査・現調・補助金・工事・入金・書類の状態を記録します。" />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StateSelect name="loanReview" label="ローン審査" labels={LOAN_REVIEW_LABELS} value={defaults.loanReview} />
            <StateSelect name="siteSurvey" label="現調" labels={SITE_SURVEY_LABELS} value={defaults.siteSurvey} />
            <Field label="現調日">
              <Input name="siteSurveyAt" type="date" defaultValue={defaults.siteSurveyAt ?? ''} />
            </Field>
            <StateSelect name="subsidy" label="補助金" labels={SUBSIDY_LABELS} value={defaults.subsidy} />

            <Field label="補助金制度">
              <Input name="subsidyProgram" defaultValue={defaults.subsidyProgram ?? ''} />
            </Field>
            <Field label="補助金申請日">
              <Input name="subsidyAppliedAt" type="date" defaultValue={defaults.subsidyAppliedAt ?? ''} />
            </Field>
            <Field label="交付決定日">
              <Input name="subsidyApprovedAt" type="date" defaultValue={defaults.subsidyApprovedAt ?? ''} />
            </Field>
            <StateSelect name="construction" label="工事手配" labels={CONSTRUCTION_LABELS} value={defaults.construction} />

            <Field label="工事予定日">
              <Input name="constructionScheduledAt" type="date" defaultValue={defaults.constructionScheduledAt ?? ''} />
            </Field>
            <Field label="工事完了日">
              <Input name="constructionCompletedAt" type="date" defaultValue={defaults.constructionCompletedAt ?? ''} />
            </Field>
            <StateSelect name="completionCheck" label="完工確認" labels={PROGRESS_LABELS} value={defaults.completionCheck} />
            <StateSelect name="gridConnection" label="系統連系" labels={PROGRESS_LABELS} value={defaults.gridConnection} />
          </div>

          <div className="grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="入金状況">
              <Select name="paymentStatus" required defaultValue={defaults.paymentStatus ?? 'PENDING'}>
                {optionsOf(DEAL_PAYMENT_STATUS_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="入金予定日">
              <Input name="paymentDueAt" type="date" defaultValue={defaults.paymentDueAt ?? ''} />
            </Field>
            <Field label="入金日">
              <Input name="paidAt" type="date" defaultValue={defaults.paidAt ?? ''} />
            </Field>
          </div>

          <div className="grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <StateSelect name="contractDocument" label="契約書" labels={PROGRESS_LABELS} value={defaults.contractDocument} />
            <StateSelect name="importantMatters" label="重要事項" labels={PROGRESS_LABELS} value={defaults.importantMatters} />
            <StateSelect name="warranty" label="保証書" labels={PROGRESS_LABELS} value={defaults.warranty} />
            <StateSelect name="sitePhotos" label="施工写真" labels={PROGRESS_LABELS} value={defaults.sitePhotos} />
          </div>

          <Field label="注意事項">
            <Textarea name="attention" rows={2} defaultValue={defaults.attention ?? ''} />
          </Field>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <SubmitButton>保存する</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => router.back()}>キャンセル</Button>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
