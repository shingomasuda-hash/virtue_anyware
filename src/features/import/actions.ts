'use server';

import { revalidatePath } from 'next/cache';
import { runAction } from '@/server/actions/run';
import { formDataToObject } from '@/lib/zod-helpers';
import { saveBatchMapping, deleteDraftBatch } from '@/server/services/import/upload';
import { planImport } from '@/server/services/import/plan';
import { commitImport } from '@/server/services/import/commit';
import { rollbackImport } from '@/server/services/import/rollback';
import { saveTemplate, deleteTemplate, findTemplate } from '@/server/services/import/templates';
import { batchIdSchema, deleteTemplateSchema, mappingSchema, parseMappingsJson, saveTemplateSchema } from './schema';

/** STEP3: 列マッピングと取込オプションを保存する。 */
export async function saveMappingAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:run', schema: mappingSchema, input: formDataToObject(formData) },
    async (ctx, input) => {
      const mappings = parseMappingsJson(input.mappings);
      await saveBatchMapping(
        ctx,
        input.batchId,
        mappings,
        {
          unknownAgency: input.unknownAgency,
          defaultStatusCode: input.defaultStatusCode,
          fixedAgencyId: input.fixedAgencyId,
          createOnReview: input.createOnReview,
        },
        input.templateId,
      );
      revalidatePath(`/import/${input.batchId}`);
      return { batchId: input.batchId };
    },
  );
}

/**
 * DRY RUN。業務データへは書き込まず、新規 / 更新 / 重複 / エラーの件数のみ返す。
 */
export async function dryRunAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:run', schema: batchIdSchema, input: formDataToObject(formData) },
    async (ctx, input) => {
      const plan = await planImport(ctx, input.batchId);
      return plan.summary;
    },
  );
}

/** STEP6: 取込確定。 */
export async function commitImportAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:run', schema: batchIdSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const summary = await commitImport(ctx, input.batchId, request);
      revalidatePath('/import');
      revalidatePath('/customers');
      revalidatePath('/contracts');
      revalidatePath('/dashboard');
      return summary;
    },
  );
}

/** バッチ単位のロールバック。取込後に人が変更したデータは巻き戻さない。 */
export async function rollbackImportAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:manage', schema: batchIdSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const result = await rollbackImport(ctx, input.batchId, request);
      revalidatePath('/import');
      revalidatePath('/customers');
      revalidatePath('/contracts');
      return result;
    },
  );
}

export async function deleteBatchAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:manage', schema: batchIdSchema, input: formDataToObject(formData) },
    async (ctx, input) => {
      await deleteDraftBatch(ctx, input.batchId);
      revalidatePath('/import');
      return { batchId: input.batchId };
    },
  );
}

/** 現在のマッピングをテンプレートとして保存する。 */
export async function saveTemplateAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:manage', schema: saveTemplateSchema, input: formDataToObject(formData) },
    async (ctx, input) => {
      const { findBatch } = await import('@/server/services/import/upload');
      const batch = await findBatch(ctx, input.batchId);
      if (!batch) throw new Error('NOT_FOUND');

      const template = await saveTemplate(ctx, {
        id: input.templateId,
        name: input.name,
        description: input.description,
        columnMappings: (batch.columnMappings ?? {}) as Record<string, string | null>,
        options: (batch.options ?? {}) as Record<string, unknown>,
      });
      revalidatePath('/import/templates');
      return { id: template.id, name: template.name };
    },
  );
}

export async function deleteTemplateAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:manage', schema: deleteTemplateSchema, input: formDataToObject(formData) },
    async (ctx, input) => {
      await deleteTemplate(ctx, input.id);
      revalidatePath('/import/templates');
      return { id: input.id };
    },
  );
}

/** テンプレートを読み込んでマッピング候補を返す（STEP3 で使用）。 */
export async function loadTemplateAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'import:run', schema: deleteTemplateSchema, input: formDataToObject(formData) },
    async (ctx, input) => {
      const template = await findTemplate(ctx, input.id);
      if (!template) throw new Error('NOT_FOUND');
      return { columnMappings: template.columnMappings, options: template.options };
    },
  );
}
