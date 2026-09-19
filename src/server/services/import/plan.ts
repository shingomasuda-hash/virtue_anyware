import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { agencyScope, orgScope, resolveWritableAgencyId } from '@/server/authz/scope';
import { normalizeRows } from '@/server/services/csv/parse';
import {
  decideDuplicate,
  nameBirthKey,
  namePostalKey,
  normalizeName,
  phoneNameKey,
  type ExistingIndex,
} from '@/server/services/csv/dedupe';
import { normalizeHeader } from '@/server/services/csv/field-catalog';
import { resolveAgencyPayoutPrice } from '@/server/services/pricing/resolve';
import { DomainError } from '@/lib/errors';
import { validateRow } from './validate';
import {
  parseColumnMappings,
  parseImportOptions,
  type ImportOptions,
  type ImportPlan,
  type PlannedRow,
  type RowDecision,
  type RowIssue,
} from './types';

/** マスタ名寄せ用の索引（コード・名称どちらでも引けるようにする）。 */
function buildLookup<T extends { id: string }>(items: readonly T[], keys: (item: T) => Array<string | null | undefined>) {
  const map = new Map<string, T>();
  for (const item of items) {
    for (const key of keys(item)) {
      if (!key) continue;
      const normalized = normalizeHeader(key);
      if (normalized && !map.has(normalized)) map.set(normalized, item);
    }
  }
  return map;
}

/**
 * 既存データの索引を作る。
 * **必ず ctx のスコープ内だけ**を対象にするため、代理店ユーザーが他代理店のデータと
 * 突合してしまうことがない。
 */
async function buildExistingIndex(ctx: AccessContext): Promise<ExistingIndex> {
  const scope = agencyScope(ctx);
  const where = {
    deletedAt: null,
    ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    ...(scope.agencyId ? { agencyId: scope.agencyId } : {}),
  };

  const [customers, contracts] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: { id: true, name: true, externalCustomerId: true, phoneNormalized: true, birthDate: true, postalCode: true },
    }),
    prisma.contract.findMany({
      where: { ...where, contractNumber: { not: null } },
      select: { id: true, customerId: true, contractNumber: true },
    }),
  ]);

  const byContractNumber = new Map<string, { contractId: string; customerId: string }>();
  for (const c of contracts) {
    if (c.contractNumber) byContractNumber.set(c.contractNumber, { contractId: c.id, customerId: c.customerId });
  }

  const byExternalCustomerId = new Map<string, string>();
  const byPhoneAndName = new Map<string, string>();
  const byPhone = new Map<string, string[]>();
  const byNameAndBirthDate = new Map<string, string>();
  const byNameAndPostal = new Map<string, string>();

  for (const c of customers) {
    if (c.externalCustomerId) byExternalCustomerId.set(c.externalCustomerId, c.id);
    if (c.phoneNormalized) {
      byPhoneAndName.set(phoneNameKey(c.phoneNormalized, c.name), c.id);
      const list = byPhone.get(c.phoneNormalized) ?? [];
      list.push(c.id);
      byPhone.set(c.phoneNormalized, list);
    }
    if (c.birthDate) byNameAndBirthDate.set(nameBirthKey(c.name, c.birthDate), c.id);
    if (c.postalCode) byNameAndPostal.set(namePostalKey(c.name, c.postalCode), c.id);
  }

  return { byContractNumber, byExternalCustomerId, byPhoneAndName, byPhone, byNameAndBirthDate, byNameAndPostal };
}

function toJsonValue(value: string | number | Date | null): string | number | null {
  if (value instanceof Date) return value.toISOString();
  return value;
}

const TRUTHY = new Set(['有', 'あり', '有り', '1', 'true', 'yes', 'y', '○', '◯', 'o', '済', '提出済']);
const FALSY = new Set(['無', 'なし', '無し', '0', 'false', 'no', 'n', '×', 'x', '未', '未提出']);

/** CSV の「有/無」「○/×」「1/0」などを真偽値へ正規化する。 */
export function parseBooleanish(value: string | number | Date | null | undefined, fallback: boolean): boolean {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return value !== 0;
  if (value instanceof Date) return fallback;
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return fallback;
}

/**
 * 取込計画を立てる（DRY RUN の本体）。
 *
 * **業務データへは一切書き込まない。** プレビュー・DRY RUN・確定のすべてが
 * この関数の結果を使うため、「プレビューでは成功していたのに確定で失敗する」が起きない。
 */
export async function planImport(ctx: AccessContext, batchId: string): Promise<ImportPlan> {
  const scope = orgScope(ctx);
  const batch = await prisma.importBatch.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id: batchId }] },
    include: { rows: { orderBy: { rowNumber: 'asc' } } },
  });
  if (!batch) throw new DomainError('取込バッチが見つかりません。');

  const mappings = parseColumnMappings(batch.columnMappings);
  const options = parseImportOptions(batch.options);
  const organizationId = batch.organizationId;

  const [agencies, statuses, suppliers, plans, products, staff, events, index] = await Promise.all([
    prisma.agency.findMany({ where: { organizationId, deletedAt: null } }),
    prisma.contractStatus.findMany({ where: { organizationId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.supplier.findMany({ where: { organizationId } }),
    prisma.plan.findMany({ where: { supplier: { organizationId } } }),
    prisma.product.findMany({ where: { organizationId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.staff.findMany({ where: { organizationId } }),
    prisma.event.findMany({ where: { organizationId } }),
    buildExistingIndex(ctx),
  ]);

  const agencyLookup = buildLookup(agencies, (a) => [a.code, a.name, a.corporateName]);
  const statusLookup = buildLookup(statuses, (s) => [s.code, s.label]);
  const supplierLookup = buildLookup(suppliers, (s) => [s.code, s.name]);
  const planLookup = buildLookup(plans, (p) => [p.code, p.name]);
  const staffLookup = buildLookup(staff, (s) => [s.code, s.name]);
  const eventLookup = buildLookup(events, (e) => [e.code, e.name, e.storeName]);

  const electricity = products.find((p) => p.category === 'ELECTRICITY') ?? products[0] ?? null;
  const defaultStatus = options.defaultStatusCode
    ? (statuses.find((s) => s.code === options.defaultStatusCode) ?? null)
    : null;

  const rawRows = batch.rows.map((r) => (r.raw ?? {}) as Record<string, string>);
  const normalized = normalizeRows(rawRows, mappings);

  // 単価マスタとの突合は代理店ごとに 1 回だけ引く（行数ぶん引かない）
  const unitPriceCache = new Map<string, number | null>();
  async function masterUnitPrice(agencyId: string | null, basisDate: Date): Promise<number | null> {
    if (!agencyId || !electricity) return null;
    const key = `${agencyId}:${basisDate.toISOString().slice(0, 10)}`;
    if (unitPriceCache.has(key)) return unitPriceCache.get(key) ?? null;
    const resolved = await resolveAgencyPayoutPrice({
      organizationId,
      agencyId,
      productId: electricity.id,
      basisDate,
    });
    const value = resolved?.unitPrice ?? null;
    unitPriceCache.set(key, value);
    return value;
  }

  // 同一ファイル内の重複も検出するため、処理済みのキーを蓄積する
  const seenContractNumbers = new Set<string>();
  const seenPhoneNames = new Set<string>();

  const rows: PlannedRow[] = [];

  for (const [i, row] of normalized.entries()) {
    const batchRow = batch.rows[i];
    const issues: RowIssue[] = row.errors.map((message) => ({ level: 'error' as const, field: null, message }));
    const values = row.values;

    // ── 参照の解決 ──
    const agencyRaw = typeof values.agencyCode === 'string' ? values.agencyCode : null;
    const agencyMatch = agencyRaw ? (agencyLookup.get(normalizeHeader(agencyRaw)) ?? null) : null;
    let agencyId = options.fixedAgencyId ?? agencyMatch?.id ?? null;
    // 代理店ユーザーは自社へ強制する（CSV に他代理店が書かれていても従わない）
    try {
      agencyId = resolveWritableAgencyId(ctx, agencyId);
    } catch {
      issues.push({ level: 'error', field: 'agencyCode', message: '自社以外の代理店データは取り込めません。' });
      agencyId = ctx.agencyId;
    }

    const statusRaw = typeof values.statusCode === 'string' ? values.statusCode : null;
    const statusMatch = statusRaw ? (statusLookup.get(normalizeHeader(statusRaw)) ?? null) : null;
    const status = statusMatch ?? defaultStatus;

    const supplierRaw = typeof values.supplierName === 'string' ? values.supplierName : null;
    const planRaw = typeof values.planName === 'string' ? values.planName : null;
    const staffRaw = typeof values.staffName === 'string' ? values.staffName : null;
    const venueRaw = typeof values.venueName === 'string' ? values.venueName : null;

    const contractedAt = values.contractedAt instanceof Date ? values.contractedAt : null;
    const appliedAt = values.appliedAt instanceof Date ? values.appliedAt : null;
    const basisDate = contractedAt ?? appliedAt ?? new Date();

    // 検針月が空なら契約日の月を使う（明細の対象月として妥当な既定値）
    const usageMonthRaw = typeof values.usageMonth === 'number' ? values.usageMonth : null;
    const usageMonth =
      usageMonthRaw !== null && usageMonthRaw >= 1 && usageMonthRaw <= 12
        ? usageMonthRaw
        : (contractedAt ?? appliedAt)?.getMonth() !== undefined
          ? ((contractedAt ?? appliedAt) as Date).getMonth() + 1
          : null;

    issues.push(
      ...validateRow(values, {
        agencyId,
        agencyRawValue: agencyRaw,
        unknownAgencyLevel: options.unknownAgency,
        statusId: status?.id ?? null,
        statusRawValue: statusRaw,
        masterUnitPrice: await masterUnitPrice(agencyId, basisDate),
        // 明細の提出がない案件は定額手数料になるため、数量が無くても取り込める
        requiresQuantity: parseBooleanish(values.hasStatement, true),
      }),
    );

    // ── 重複判定 ──
    const contractNumber = typeof values.contractNumber === 'string' ? values.contractNumber : null;
    const phoneNormalized = typeof values.phone === 'string' ? values.phone : null;
    const name = typeof values.customerName === 'string' ? values.customerName : null;

    const dedupe = decideDuplicate(
      {
        contractNumber,
        externalCustomerId: typeof values.externalCustomerId === 'string' ? values.externalCustomerId : null,
        phoneNormalized,
        name,
        birthDate: values.birthDate instanceof Date ? values.birthDate : null,
        postalCode: typeof values.postalCode === 'string' ? values.postalCode : null,
      },
      index,
    );

    // 同一ファイル内の重複（同じ CSV に同じ契約番号が 2 行ある）
    let inFileDuplicate = false;
    if (contractNumber) {
      if (seenContractNumbers.has(contractNumber)) inFileDuplicate = true;
      else seenContractNumbers.add(contractNumber);
    } else if (phoneNormalized && name) {
      const key = phoneNameKey(phoneNormalized, name);
      if (seenPhoneNames.has(key)) inFileDuplicate = true;
      else seenPhoneNames.add(key);
    }
    if (inFileDuplicate) {
      issues.push({ level: 'warning', field: null, message: '同じファイル内に同一の契約が複数行あります。最初の行のみ取り込みます。' });
    }

    if (dedupe.decision === 'NEEDS_REVIEW' && dedupe.reason) {
      issues.push({ level: 'warning', field: null, message: dedupe.reason });
    }

    // ── 最終的な扱いを決める ──
    const hasError = issues.some((issue) => issue.level === 'error');
    let decision: RowDecision;
    if (hasError) {
      decision = 'ERROR';
    } else if (inFileDuplicate) {
      decision = 'DUPLICATE';
    } else if (dedupe.decision === 'UPDATE_CONTRACT') {
      decision = 'UPDATE';
    } else if (dedupe.decision === 'NEEDS_REVIEW') {
      // 完全一致ではないため、既定では自動登録しない（§9）
      decision = options.createOnReview ? 'CREATE' : 'DUPLICATE';
    } else {
      decision = 'CREATE';
    }

    const jsonValues: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(values)) jsonValues[key] = toJsonValue(value);

    rows.push({
      rowNumber: batchRow?.rowNumber ?? i + 1,
      raw: row.raw,
      values: jsonValues,
      decision,
      issues,
      matchedBy: dedupe.matchedBy,
      customerId: dedupe.customerId,
      contractId: dedupe.contractId,
      resolved: {
        agencyId,
        agencyLabel: agencyMatch?.name ?? (agencyId ? (agencies.find((a) => a.id === agencyId)?.name ?? null) : null),
        statusId: status?.id ?? null,
        statusLabel: status?.label ?? null,
        supplierId: supplierRaw ? (supplierLookup.get(normalizeHeader(supplierRaw))?.id ?? null) : null,
        planId: planRaw ? (planLookup.get(normalizeHeader(planRaw))?.id ?? null) : null,
        productId: electricity?.id ?? null,
        staffId: staffRaw ? (staffLookup.get(normalizeHeader(staffRaw))?.id ?? null) : null,
        eventId: venueRaw ? (eventLookup.get(normalizeHeader(venueRaw))?.id ?? null) : null,
        usageMonth,
        actualUsageKwh: typeof values.actualUsageKwh === 'number' ? values.actualUsageKwh : null,
        hasStatement: parseBooleanish(values.hasStatement, true),
        isMatchingConfirmed: parseBooleanish(values.isMatchingConfirmed, false),
      },
    });
  }

  return {
    batchId,
    summary: {
      totalRows: rows.length,
      createCount: rows.filter((r) => r.decision === 'CREATE').length,
      updateCount: rows.filter((r) => r.decision === 'UPDATE').length,
      duplicateCount: rows.filter((r) => r.decision === 'DUPLICATE').length,
      errorCount: rows.filter((r) => r.decision === 'ERROR').length,
      warningCount: rows.filter((r) => r.issues.some((i) => i.level === 'warning')).length,
    },
    rows,
  };
}

export { normalizeName };
export type { ImportOptions };
