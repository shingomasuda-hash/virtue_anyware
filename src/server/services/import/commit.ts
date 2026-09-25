import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { createCustomer, updateCustomer } from '@/server/services/customers';
import { createContract, updateContract } from '@/server/services/contract-write';
import { recordAudit, type AuditRequestInfo } from '@/server/services/audit';
import { DomainError } from '@/lib/errors';
import { planImport } from './plan';
import type { ImportPlanSummary, PlannedRow } from './types';

function asDate(value: string | number | null): Date | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asString(value: string | number | null): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asNumber(value: string | number | null): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/** 未入力を 0 に潰さない数値変換。金額・年月のように 0 と空欄の意味が違う項目に使う。 */
function asNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 取込を確定する（STEP6）。
 *
 * - 全行をひとつのトランザクションで処理する。1 行でも想定外の失敗が起きれば全体を巻き戻す。
 * - ERROR / DUPLICATE の行はスキップし、理由を `import_rows` に記録する。
 * - 顧客・契約の作成は通常画面と同じサービスを通るため、単価スナップショット・
 *   対応履歴・アップセルリード生成がすべて同じように行われる。
 */
export async function commitImport(
  ctx: AccessContext,
  batchId: string,
  request?: AuditRequestInfo,
): Promise<ImportPlanSummary & { successCount: number }> {
  const scope = orgScope(ctx);
  const batch = await prisma.importBatch.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id: batchId }] },
  });
  if (!batch) throw new DomainError('取込バッチが見つかりません。');
  if (batch.status === 'COMMITTED') throw new DomainError('この取込は既に確定済みです。');
  if (batch.status === 'ROLLED_BACK') throw new DomainError('この取込はロールバック済みのため確定できません。');

  // 確定直前にもう一度評価する（プレビュー後にデータが変わっている可能性があるため）
  const plan = await planImport(ctx, batchId);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const row of plan.rows) {
        const importRow = await tx.importRow.findFirst({ where: { batchId, rowNumber: row.rowNumber } });
        if (!importRow) continue;

        const baseData = {
          normalized: row.values as Prisma.InputJsonValue,
          errors: row.issues.filter((i) => i.level === 'error') as unknown as Prisma.InputJsonValue,
          warnings: row.issues.filter((i) => i.level === 'warning') as unknown as Prisma.InputJsonValue,
          matchedBy: row.matchedBy,
        };

        if (row.decision === 'ERROR') {
          await tx.importRow.update({ where: { id: importRow.id }, data: { ...baseData, status: 'FAILED' } });
          skipped += 1;
          continue;
        }
        if (row.decision === 'DUPLICATE') {
          await tx.importRow.update({
            where: { id: importRow.id },
            data: { ...baseData, status: row.matchedBy ? 'NEEDS_REVIEW' : 'SKIPPED_DUPLICATE', customerId: row.customerId },
          });
          skipped += 1;
          continue;
        }

        const result = await applyRow(tx, ctx, batchId, row);
        await tx.importRow.update({
          where: { id: importRow.id },
          data: {
            ...baseData,
            status: result.kind === 'created' ? 'CREATED' : 'UPDATED',
            customerId: result.customerId,
            contractId: result.contractId,
            createdCustomer: result.createdCustomer,
            createdContract: result.createdContract,
            beforeSnapshot: result.beforeSnapshot ?? Prisma.JsonNull,
            customerUpdatedAt: result.customerUpdatedAt,
            contractUpdatedAt: result.contractUpdatedAt,
          },
        });

        if (result.kind === 'created') created += 1;
        else updated += 1;
      }
    },
    { timeout: 120_000 },
  );

  const summary: ImportPlanSummary = {
    totalRows: plan.summary.totalRows,
    createCount: created,
    updateCount: updated,
    duplicateCount: plan.summary.duplicateCount,
    errorCount: plan.summary.errorCount,
    warningCount: plan.summary.warningCount,
  };

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: 'COMMITTED',
      totalRows: summary.totalRows,
      createdCount: created,
      updatedCount: updated,
      duplicateCount: summary.duplicateCount,
      failureCount: summary.errorCount,
      warningCount: summary.warningCount,
      successCount: created + updated,
      finishedAt: new Date(),
    },
  });

  await recordAudit(ctx, {
    action: 'import.commit',
    entity: 'import_batch',
    entityId: batchId,
    after: { ...summary, skipped, fileName: batch.fileName },
    ...request,
  });

  return { ...summary, successCount: created + updated };
}

type TxClient = Prisma.TransactionClient;

interface ApplyResult {
  kind: 'created' | 'updated';
  customerId: string;
  contractId: string | null;
  createdCustomer: boolean;
  createdContract: boolean;
  beforeSnapshot: Prisma.InputJsonValue | null;
  customerUpdatedAt: Date | null;
  contractUpdatedAt: Date | null;
}

/** 1 行を適用する。顧客・契約とも通常画面と同じサービスを経由する。 */
async function applyRow(tx: TxClient, ctx: AccessContext, batchId: string, row: PlannedRow): Promise<ApplyResult> {
  const v = row.values;
  const customerInput = {
    agencyId: row.resolved.agencyId,
    externalCustomerId: asString(v.externalCustomerId ?? null),
    name: asString(v.customerName ?? null) ?? '（氏名なし）',
    nameKana: asString(v.customerNameKana ?? null),
    phone: asString(v.phone ?? null),
    mobilePhone: asString(v.mobilePhone ?? null),
    contactPersonName: asString(v.contactPersonName ?? null),
    email: asString(v.email ?? null),
    postalCode: asString(v.postalCode ?? null),
    prefecture: asString(v.prefecture ?? null),
    city: asString(v.city ?? null),
    address: asString(v.address ?? null),
    building: asString(v.building ?? null),
    birthDate: asDate(v.birthDate ?? null),
    sourceEventId: row.resolved.eventId,
    notes: asString(v.notes ?? null),
  };

  let customerId = row.customerId;
  let createdCustomer = false;
  let beforeSnapshot: Prisma.InputJsonValue | null = null;

  if (customerId) {
    const result = await updateCustomer(ctx, customerId, customerInput, { db: tx, batchId });
    if (!result) throw new DomainError(`行 ${row.rowNumber}: 顧客を更新できませんでした。`);
    beforeSnapshot = {
      customer: {
        name: result.before.name,
        nameKana: result.before.nameKana,
        phone: result.before.phone,
        email: result.before.email,
        postalCode: result.before.postalCode,
        prefecture: result.before.prefecture,
        city: result.before.city,
        address: result.before.address,
        building: result.before.building,
        birthDate: result.before.birthDate?.toISOString() ?? null,
        externalCustomerId: result.before.externalCustomerId,
      },
    };
  } else {
    const customer = await createCustomer(ctx, customerInput, { db: tx, batchId, source: `CSV 取込 (行 ${row.rowNumber})` });
    customerId = customer.id;
    createdCustomer = true;
  }

  const contractInput = {
    customerId,
    productId: row.resolved.productId ?? '',
    agencyId: row.resolved.agencyId,
    contractNumber: asString(v.contractNumber ?? null),
    supplierId: row.resolved.supplierId,
    planId: row.resolved.planId,
    contractWatt: asNumber(v.contractWatt ?? 0),
    actualUsageKwh: row.resolved.actualUsageKwh,
    usageMonth: row.resolved.usageMonth,
    hasStatement: row.resolved.hasStatement,
    isMatchingConfirmed: row.resolved.isMatchingConfirmed,
    usageAmountYen: asNullableNumber(v.usageAmountYen),
    matchedAt: asDate(v.matchedAt ?? null),
    matchingMonth: asNullableNumber(v.matchingMonth),
    documentMailStatus: asString(v.documentMailStatus ?? null),
    followUpStatus: asString(v.followUpStatus ?? null),
    areaName: asString(v.areaName ?? null),
    paymentMethodLabel: asString(v.paymentMethodLabel ?? null),
    statusId: row.resolved.statusId ?? '',
    appliedAt: asDate(v.appliedAt ?? null),
    contractedAt: asDate(v.contractedAt ?? null),
    activatedAt: asDate(v.activatedAt ?? null),
    eventId: row.resolved.eventId,
    staffId: row.resolved.staffId,
    campaign: asString(v.campaign ?? null),
    notes: asString(v.notes ?? null),
  };

  let contractId = row.contractId;
  let createdContract = false;

  if (contractId) {
    const result = await updateContract(ctx, contractId, contractInput, { db: tx, batchId });
    if (!result) throw new DomainError(`行 ${row.rowNumber}: 契約を更新できませんでした。`);
    beforeSnapshot = {
      ...(typeof beforeSnapshot === 'object' && beforeSnapshot !== null ? beforeSnapshot : {}),
      contract: {
        contractNumber: result.before.contractNumber,
        statusId: result.before.statusId,
        contractWatt: result.before.contractWatt.toString(),
        hqUnitPrice: result.before.hqUnitPrice.toString(),
        agencyUnitPrice: result.before.agencyUnitPrice.toString(),
        hqRevenue: result.before.hqRevenue.toString(),
        agencyPayout: result.before.agencyPayout.toString(),
        hqGrossProfit: result.before.hqGrossProfit.toString(),
        grossMargin: result.before.grossMargin.toString(),
        contractedAt: result.before.contractedAt?.toISOString() ?? null,
        appliedAt: result.before.appliedAt?.toISOString() ?? null,
        activatedAt: result.before.activatedAt?.toISOString() ?? null,
      },
    };
  } else {
    const contract = await createContract(ctx, contractInput, { db: tx, batchId, reason: 'csv-import' });
    contractId = contract.id;
    createdContract = true;
  }

  const [customerAfter, contractAfter] = await Promise.all([
    tx.customer.findUnique({ where: { id: customerId }, select: { updatedAt: true } }),
    contractId ? tx.contract.findUnique({ where: { id: contractId }, select: { updatedAt: true } }) : Promise.resolve(null),
  ]);

  return {
    kind: createdCustomer || createdContract ? 'created' : 'updated',
    customerId,
    contractId,
    createdCustomer,
    createdContract,
    beforeSnapshot,
    customerUpdatedAt: customerAfter?.updatedAt ?? null,
    contractUpdatedAt: contractAfter?.updatedAt ?? null,
  };
}
