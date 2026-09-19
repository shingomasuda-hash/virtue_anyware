'use server';

import { revalidatePath } from 'next/cache';
import { runAction } from '@/server/actions/run';
import { addAgencyUnitPrice, createAgency, updateAgency } from '@/server/services/agencies';
import { formDataToObject } from '@/lib/zod-helpers';
import { agencyFormSchema, agencyUnitPriceSchema, agencyUpdateSchema } from './schema';

export async function createAgencyAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'agency:write', schema: agencyFormSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const agency = await createAgency(ctx, input, request);
      revalidatePath('/agencies');
      return { id: agency.id };
    },
  );
}

export async function updateAgencyAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'agency:write', schema: agencyUpdateSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const { id, ...rest } = input;
      const result = await updateAgency(ctx, id, rest, request);
      if (!result) throw new Error('NOT_FOUND');
      revalidatePath('/agencies');
      revalidatePath(`/agencies/${id}`);
      return { id };
    },
  );
}

/** 単価の追加は pricing:write（本部管理者以上）のみ。代理店ロールは実行できない。 */
export async function addAgencyUnitPriceAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'pricing:write', schema: agencyUnitPriceSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const price = await addAgencyUnitPrice(ctx, input, request);
      revalidatePath(`/agencies/${input.agencyId}`);
      return { id: price.id };
    },
  );
}
