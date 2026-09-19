import type { Prisma} from '@/generated/prisma';
import { type PrismaClient } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { agencyScope, resolveWritableAgencyId } from '@/server/authz/scope';
import { customerScopeWhere } from '@/server/repositories/customer.repo';
import { normalizePhone } from '@/server/services/csv/field-catalog';
import { recordAudit, type AuditRequestInfo } from '@/server/services/audit';
import { DomainError } from '@/lib/errors';

export type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface CustomerWriteInput {
  agencyId?: string | null;
  externalCustomerId?: string | null;
  name: string;
  nameKana?: string | null;
  phone?: string | null;
  email?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address?: string | null;
  building?: string | null;
  birthDate?: Date | null;
  assignedUserId?: string | null;
  sourceEventId?: string | null;
  notes?: string | null;
}

/** 監査ログ・差分比較に使う、顧客の意味のあるフィールドだけを抜き出す。 */
function snapshotOf(customer: {
  name: string;
  nameKana: string | null;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  address: string | null;
  building: string | null;
  birthDate: Date | null;
  agencyId: string | null;
  externalCustomerId: string | null;
  assignedUserId: string | null;
}): Prisma.InputJsonValue {
  return {
    name: customer.name,
    nameKana: customer.nameKana,
    phone: customer.phone,
    email: customer.email,
    postalCode: customer.postalCode,
    prefecture: customer.prefecture,
    city: customer.city,
    address: customer.address,
    building: customer.building,
    birthDate: customer.birthDate ? customer.birthDate.toISOString() : null,
    agencyId: customer.agencyId,
    externalCustomerId: customer.externalCustomerId,
    assignedUserId: customer.assignedUserId,
  };
}

function resolveOrganizationId(ctx: AccessContext): string {
  const scope = agencyScope(ctx);
  const organizationId = scope.organizationId ?? ctx.organizationId;
  if (!organizationId) throw new DomainError('組織が特定できないため登録できません。');
  return organizationId;
}

/**
 * 顧客を作成する。CSV 取込からも同じ関数を使うため db を差し替えられる。
 *
 * - `agencyId` はクライアント入力を信用せず `resolveWritableAgencyId` で決める
 *   （代理店ロールは自社固定。他代理店を指定すると例外）
 * - 電話番号は重複判定キーとして `phoneNormalized` に正規化保存する
 */
export async function createCustomer(
  ctx: AccessContext,
  input: CustomerWriteInput,
  options: { db?: PrismaLike; batchId?: string | null; source?: string } = {},
) {
  const db = options.db ?? prisma;
  const organizationId = resolveOrganizationId(ctx);
  const agencyId = resolveWritableAgencyId(ctx, input.agencyId ?? null);
  const phone = input.phone?.trim() || null;

  const customer = await db.customer.create({
    data: {
      organizationId,
      agencyId,
      externalCustomerId: input.externalCustomerId?.trim() || null,
      name: input.name.trim(),
      nameKana: input.nameKana?.trim() || null,
      phone,
      phoneNormalized: normalizePhone(phone),
      email: input.email?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      prefecture: input.prefecture?.trim() || null,
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      building: input.building?.trim() || null,
      birthDate: input.birthDate ?? null,
      assignedUserId: input.assignedUserId || null,
      sourceEventId: input.sourceEventId || null,
      notes: input.notes?.trim() || null,
      createdByBatchId: options.batchId ?? null,
    },
  });

  await db.customerActivity.create({
    data: {
      organizationId,
      customerId: customer.id,
      type: options.batchId ? 'CSV_IMPORT' : 'CUSTOMER_CREATED',
      title: options.batchId ? 'CSV 取込により顧客を登録しました' : '顧客を登録しました',
      body: options.source ?? null,
      actorUserId: ctx.userId,
    },
  });

  return customer;
}

/** 顧客を更新する。スコープ外の ID は null を返す（他代理店の顧客は更新できない）。 */
export async function updateCustomer(
  ctx: AccessContext,
  id: string,
  input: Partial<CustomerWriteInput>,
  options: { db?: PrismaLike; batchId?: string | null; request?: AuditRequestInfo } = {},
) {
  const db = options.db ?? prisma;

  const before = await db.customer.findFirst({ where: { AND: [customerScopeWhere(ctx), { id }] } });
  if (!before) return null;

  // 代理店ロールが他代理店へ付け替えようとした場合は例外
  const agencyId =
    input.agencyId === undefined ? before.agencyId : resolveWritableAgencyId(ctx, input.agencyId);
  const phone = input.phone === undefined ? before.phone : (input.phone?.trim() || null);

  const updated = await db.customer.update({
    where: { id },
    data: {
      agencyId,
      externalCustomerId: input.externalCustomerId === undefined ? undefined : (input.externalCustomerId?.trim() || null),
      name: input.name === undefined ? undefined : input.name.trim(),
      nameKana: input.nameKana === undefined ? undefined : (input.nameKana?.trim() || null),
      phone,
      phoneNormalized: normalizePhone(phone),
      email: input.email === undefined ? undefined : (input.email?.trim() || null),
      postalCode: input.postalCode === undefined ? undefined : (input.postalCode?.trim() || null),
      prefecture: input.prefecture === undefined ? undefined : (input.prefecture?.trim() || null),
      city: input.city === undefined ? undefined : (input.city?.trim() || null),
      address: input.address === undefined ? undefined : (input.address?.trim() || null),
      building: input.building === undefined ? undefined : (input.building?.trim() || null),
      birthDate: input.birthDate === undefined ? undefined : input.birthDate,
      assignedUserId: input.assignedUserId === undefined ? undefined : (input.assignedUserId || null),
      notes: input.notes === undefined ? undefined : (input.notes?.trim() || null),
    },
  });

  await db.customerActivity.create({
    data: {
      organizationId: updated.organizationId,
      customerId: updated.id,
      type: options.batchId ? 'CSV_IMPORT' : 'CUSTOMER_UPDATED',
      title: options.batchId ? 'CSV 取込により顧客情報を更新しました' : '顧客情報を更新しました',
      actorUserId: ctx.userId,
    },
  });

  // 個人情報の変更は変更前後を残す（§27）
  await recordAudit(ctx, {
    action: 'customer.update',
    entity: 'customer',
    entityId: updated.id,
    before: snapshotOf(before),
    after: snapshotOf(updated),
    ...options.request,
  });

  return { before, updated };
}

/** 論理削除。物理削除はしない（監査要件）。 */
export async function softDeleteCustomer(ctx: AccessContext, id: string, request?: AuditRequestInfo) {
  const before = await prisma.customer.findFirst({ where: { AND: [customerScopeWhere(ctx), { id }] } });
  if (!before) return null;

  const updated = await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit(ctx, {
    action: 'customer.delete',
    entity: 'customer',
    entityId: id,
    before: snapshotOf(before),
    after: null,
    ...request,
  });
  return updated;
}
