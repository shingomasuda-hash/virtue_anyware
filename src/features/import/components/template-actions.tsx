'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { deleteTemplateAction } from '../actions';

type State = ActionResult<{ id: string }> | null;

export function TemplateRowActions({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [, formAction] = useActionState<State, FormData>(async (prev, formData) => {
    const result = (await deleteTemplateAction(prev, formData)) as State;
    if (result?.ok) router.refresh();
    return result;
  }, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={templateId} />
      <SubmitButton variant="danger">削除</SubmitButton>
    </form>
  );
}
