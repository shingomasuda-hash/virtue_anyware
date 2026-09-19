'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { runAction } from '@/server/actions/run';
import { createCustomer, updateCustomer } from '@/server/services/customers';
import { recordAudit } from '@/server/services/audit';
import { formDataToObject } from '@/lib/zod-helpers';
import { customerFormSchema, customerUpdateSchema } from './schema';

export async function createCustomerAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'customer:write', schema: customerFormSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const customer = await createCustomer(ctx, input);
      await recordAudit(ctx, {
        action: 'customer.create',
        entity: 'customer',
        entityId: customer.id,
        after: { name: customer.name, agencyId: customer.agencyId },
        ...request,
      });
      revalidatePath('/customers');
      revalidatePath('/agency/customers');
      return { id: customer.id };
    },
  );
}

export async function updateCustomerAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'customer:write', schema: customerUpdateSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const { id, ...rest } = input;
      const result = await updateCustomer(ctx, id, rest, { request });
      // スコープ外の ID は null。他代理店の顧客は更新できない。
      if (!result) throw new Error('NOT_FOUND');
      revalidatePath(`/customers/${id}`);
      revalidatePath(`/agency/customers/${id}`);
      return { id };
    },
  );
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function archiveCustomerAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'customer:write', schema: deleteSchema, input: formDataToObject(formData) },
    async (ctx, input) => {
      const { softDeleteCustomer } = await import('@/server/services/customers');
      const result = await softDeleteCustomer(ctx, input.id);
      if (!result) throw new Error('NOT_FOUND');
      revalidatePath('/customers');
      return { id: input.id };
    },
  );
}
