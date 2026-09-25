'use server';

import { revalidatePath } from 'next/cache';
import { runAction } from '@/server/actions/run';
import { createDeal, updateDeal, upsertDealCompensation, upsertDealProgress } from '@/server/services/deals/write';
import { formDataToObject } from '@/lib/zod-helpers';
import { dealCompensationSchema, dealFormSchema, dealProgressSchema, dealUpdateSchema } from './schema';

export async function createDealAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'deal:write', schema: dealFormSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const deal = await createDeal(ctx, input, request);
      revalidatePath('/deals');
      return { id: deal.id };
    },
  );
}

export async function updateDealAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'deal:write', schema: dealUpdateSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const { id, ...rest } = input;
      const result = await updateDeal(ctx, id, rest, request);
      if (!result) throw new Error('NOT_FOUND');
      revalidatePath('/deals');
      revalidatePath(`/deals/${id}`);
      return { id };
    },
  );
}

export async function saveDealProgressAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'deal:progress', schema: dealProgressSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const { dealId, ...rest } = input;
      const saved = await upsertDealProgress(ctx, dealId, rest, request);
      if (!saved) throw new Error('NOT_FOUND');
      revalidatePath(`/deals/${dealId}`);
      return { id: dealId };
    },
  );
}

/** 報酬は本部管理者のみ（§17）。金額はサーバー側の計算結果だけを保存する。 */
export async function saveDealCompensationAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'deal:compensation', schema: dealCompensationSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const { dealId, ...rest } = input;
      const saved = await upsertDealCompensation(ctx, dealId, rest, request);
      if (!saved) throw new Error('NOT_FOUND');
      revalidatePath(`/deals/${dealId}`);
      return { id: dealId };
    },
  );
}
