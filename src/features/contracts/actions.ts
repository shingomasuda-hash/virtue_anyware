'use server';

import { revalidatePath } from 'next/cache';
import { runAction } from '@/server/actions/run';
import { cancelContract, createContract, repriceContract, updateContract } from '@/server/services/contract-write';
import { formDataToObject } from '@/lib/zod-helpers';
import { contractCancelSchema, contractFormSchema, contractRepriceSchema, contractUpdateSchema } from './schema';

function revalidateContract(id?: string) {
  revalidatePath('/contracts');
  revalidatePath('/agency/contracts');
  revalidatePath('/dashboard');
  if (id) {
    revalidatePath(`/contracts/${id}`);
    revalidatePath(`/agency/contracts/${id}`);
  }
}

export async function createContractAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'contract:write', schema: contractFormSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const contract = await createContract(ctx, input, { request });
      revalidateContract(contract.id);
      revalidatePath(`/customers/${input.customerId}`);
      return { id: contract.id };
    },
  );
}

export async function updateContractAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'contract:write', schema: contractUpdateSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const { id, ...rest } = input;
      const result = await updateContract(ctx, id, rest, { request });
      if (!result) throw new Error('NOT_FOUND');
      revalidateContract(id);
      return { id, repriced: result.repriced };
    },
  );
}

export async function cancelContractAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'contract:write', schema: contractCancelSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const result = await cancelContract(ctx, input.id, input.reason, request);
      if (!result) throw new Error('NOT_FOUND');
      revalidateContract(input.id);
      return { id: input.id };
    },
  );
}

/** 単価再適用は財務数値を動かすため、本部管理者（pricing:write）のみ実行できる。 */
export async function repriceContractAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: ['contract:write', 'pricing:write'], schema: contractRepriceSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const result = await repriceContract(ctx, input.id, input.reason, request);
      if (!result) throw new Error('NOT_FOUND');
      revalidateContract(input.id);
      return { id: input.id };
    },
  );
}
