import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { recordAudit, type AuditRequestInfo } from '@/server/services/audit';
import { DomainError } from '@/lib/errors';

export interface RollbackRowResult {
  rowNumber: number;
  outcome: 'deleted' | 'restored' | 'skipped';
  reason?: string;
}

export interface RollbackResult {
  deletedCustomers: number;
  deletedContracts: number;
  restoredRecords: number;
  skipped: number;
  rows: RollbackRowResult[];
}

/**
 * 取込バッチ単位のロールバック。
 *
 * **取込後に人が変更したデータは巻き戻さない。**
 * 判定方法: 取込直後に記録した `updatedAt` と現在値を比較し、
 * 異なれば「取込後に変更あり」とみなしてスキップする。
 *
 * - このバッチが**新規作成**したレコード → 論理削除（変更されていなければ）
 * - このバッチが**更新**したレコード     → `beforeSnapshot` から復元（変更されていなければ）
 *
 * 契約に売上・精算明細がぶら下がっている場合も安全のためスキップする。
 */
export async function rollbackImport(
  ctx: AccessContext,
  batchId: string,
  request?: AuditRequestInfo,
): Promise<RollbackResult> {
  const scope = orgScope(ctx);
  const batch = await prisma.importBatch.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id: batchId }] },
    include: { rows: { orderBy: { rowNumber: 'asc' } } },
  });
  if (!batch) throw new DomainError('取込バッチが見つかりません。');
  // ロールバック済みの判定を先に行う（status が ROLLED_BACK になっているため）
  if (batch.rolledBackAt || batch.status === 'ROLLED_BACK') {
    throw new DomainError('この取込は既にロールバック済みです。');
  }
  if (batch.status !== 'COMMITTED') throw new DomainError('確定済みの取込のみロールバックできます。');

  const result: RollbackResult = {
    deletedCustomers: 0,
    deletedContracts: 0,
    restoredRecords: 0,
    skipped: 0,
    rows: [],
  };

  await prisma.$transaction(
    async (tx) => {
      for (const row of batch.rows) {
        if (row.status !== 'CREATED' && row.status !== 'UPDATED') continue;

        const skip = (reason: string) => {
          result.skipped += 1;
          result.rows.push({ rowNumber: row.rowNumber, outcome: 'skipped', reason });
        };

        // ── 契約 ──
        if (row.contractId) {
          const contract = await tx.contract.findUnique({ where: { id: row.contractId } });
          if (!contract || contract.deletedAt) {
            skip('契約が既に削除されています。');
            continue;
          }
          // 取込後に人が変更していないか
          if (row.contractUpdatedAt && contract.updatedAt.getTime() !== row.contractUpdatedAt.getTime()) {
            skip('取込後に契約が変更されているため巻き戻しません。');
            continue;
          }
          // 売上・精算が発生していたら触らない
          const [revenues, settlementItems] = await Promise.all([
            tx.revenue.count({ where: { contractId: contract.id } }),
            tx.settlementItem.count({ where: { contractId: contract.id } }),
          ]);
          if (revenues > 0 || settlementItems > 0) {
            skip('売上または精算明細が紐づいているため巻き戻しません。');
            continue;
          }

          if (row.createdContract) {
            await tx.contract.update({ where: { id: contract.id }, data: { deletedAt: new Date() } });
            result.deletedContracts += 1;
          } else {
            const snapshot = (row.beforeSnapshot ?? {}) as Record<string, unknown>;
            const contractSnapshot = snapshot.contract as Record<string, string | null> | undefined;
            if (!contractSnapshot) {
              skip('復元用のスナップショットがありません。');
              continue;
            }
            await tx.contract.update({
              where: { id: contract.id },
              data: {
                contractNumber: contractSnapshot.contractNumber ?? null,
                statusId: contractSnapshot.statusId ?? contract.statusId,
                contractWatt: contractSnapshot.contractWatt ?? contract.contractWatt,
                hqUnitPrice: contractSnapshot.hqUnitPrice ?? contract.hqUnitPrice,
                agencyUnitPrice: contractSnapshot.agencyUnitPrice ?? contract.agencyUnitPrice,
                hqRevenue: contractSnapshot.hqRevenue ?? contract.hqRevenue,
                agencyPayout: contractSnapshot.agencyPayout ?? contract.agencyPayout,
                hqGrossProfit: contractSnapshot.hqGrossProfit ?? contract.hqGrossProfit,
                grossMargin: contractSnapshot.grossMargin ?? contract.grossMargin,
                contractedAt: contractSnapshot.contractedAt ? new Date(contractSnapshot.contractedAt) : null,
                appliedAt: contractSnapshot.appliedAt ? new Date(contractSnapshot.appliedAt) : null,
                activatedAt: contractSnapshot.activatedAt ? new Date(contractSnapshot.activatedAt) : null,
              },
            });
            result.restoredRecords += 1;
          }
        }

        // ── 顧客 ──
        if (row.customerId) {
          const customer = await tx.customer.findUnique({ where: { id: row.customerId } });
          if (!customer || customer.deletedAt) {
            result.rows.push({ rowNumber: row.rowNumber, outcome: row.createdContract ? 'deleted' : 'restored' });
            continue;
          }
          if (row.customerUpdatedAt && customer.updatedAt.getTime() !== row.customerUpdatedAt.getTime()) {
            skip('取込後に顧客が変更されているため巻き戻しません。');
            continue;
          }

          if (row.createdCustomer) {
            // このバッチ以外で作られた契約が残っていれば顧客は消さない
            const otherContracts = await tx.contract.count({
              where: { customerId: customer.id, deletedAt: null, OR: [{ createdByBatchId: null }, { createdByBatchId: { not: batchId } }] },
            });
            if (otherContracts > 0) {
              skip('この取込以外の契約が紐づいているため顧客は残します。');
              continue;
            }
            await tx.customer.update({ where: { id: customer.id }, data: { deletedAt: new Date() } });
            result.deletedCustomers += 1;
            result.rows.push({ rowNumber: row.rowNumber, outcome: 'deleted' });
          } else {
            const snapshot = (row.beforeSnapshot ?? {}) as Record<string, unknown>;
            const customerSnapshot = snapshot.customer as Record<string, string | null> | undefined;
            if (!customerSnapshot) {
              skip('復元用のスナップショットがありません。');
              continue;
            }
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                name: customerSnapshot.name ?? customer.name,
                nameKana: customerSnapshot.nameKana ?? null,
                phone: customerSnapshot.phone ?? null,
                email: customerSnapshot.email ?? null,
                postalCode: customerSnapshot.postalCode ?? null,
                prefecture: customerSnapshot.prefecture ?? null,
                city: customerSnapshot.city ?? null,
                address: customerSnapshot.address ?? null,
                building: customerSnapshot.building ?? null,
                birthDate: customerSnapshot.birthDate ? new Date(customerSnapshot.birthDate) : null,
                externalCustomerId: customerSnapshot.externalCustomerId ?? null,
              },
            });
            result.restoredRecords += 1;
            result.rows.push({ rowNumber: row.rowNumber, outcome: 'restored' });
          }
        }
      }

      await tx.importBatch.update({
        where: { id: batchId },
        data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
      });
    },
    { timeout: 120_000 },
  );

  await recordAudit(ctx, {
    action: 'import.rollback',
    entity: 'import_batch',
    entityId: batchId,
    after: {
      deletedCustomers: result.deletedCustomers,
      deletedContracts: result.deletedContracts,
      restoredRecords: result.restoredRecords,
      skipped: result.skipped,
    },
    ...request,
  });

  return result;
}
