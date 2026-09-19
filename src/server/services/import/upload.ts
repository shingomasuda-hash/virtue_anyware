import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { parseCsv } from '@/server/services/csv/parse';
import { DomainError } from '@/lib/errors';
import type { CsvEncoding } from '@/server/services/csv/encoding';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_ROWS = 50_000;

export interface UploadResult {
  batchId: string;
  fileName: string;
  encoding: CsvEncoding;
  headers: string[];
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
  /** 同じファイルが過去に取り込まれていれば警告する */
  duplicateOfBatch: { id: string; fileName: string; createdAt: Date; status: string } | null;
}

/**
 * STEP1/2: アップロードと解析。
 *
 * 業務データ（顧客・契約）へは書き込まず、`import_batches`(DRAFT) と
 * `import_rows`(PENDING) にステージングするだけ。確定は STEP6 まで行われない。
 */
export async function uploadCsv(
  ctx: AccessContext,
  file: { name: string; size: number; buffer: Uint8Array },
  encoding?: CsvEncoding | 'auto',
): Promise<UploadResult> {
  const scope = orgScope(ctx);
  const organizationId = scope.organizationId ?? ctx.organizationId;
  if (!organizationId) throw new DomainError('組織が特定できないため取り込めません。');

  if (!/\.(csv|txt)$/i.test(file.name)) {
    throw new DomainError('CSV ファイル（.csv / .txt）のみ取り込めます。');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DomainError(`ファイルサイズが上限（${MAX_UPLOAD_BYTES / 1024 / 1024}MB）を超えています。`);
  }

  const parsed = parseCsv(file.buffer, encoding);
  if (parsed.headers.length === 0) {
    throw new DomainError('ヘッダー行を読み取れませんでした。1 行目に列名がある CSV を指定してください。');
  }
  if (parsed.rows.length === 0) {
    throw new DomainError('データ行がありません。');
  }
  if (parsed.rows.length > MAX_ROWS) {
    throw new DomainError(`行数が上限（${MAX_ROWS.toLocaleString()} 行）を超えています。ファイルを分割してください。`);
  }

  const fileHash = createHash('sha256').update(file.buffer).digest('hex');

  // 同一ファイルの再アップロードを検知して警告する（§9 / 二重取込の第一防波堤）
  const duplicateOfBatch = await prisma.importBatch.findFirst({
    where: { organizationId, fileHash, status: { in: ['COMMITTED', 'DRAFT', 'VALIDATED'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, createdAt: true, status: true },
  });

  const batch = await prisma.importBatch.create({
    data: {
      organizationId,
      agencyId: ctx.agencyId,
      fileName: file.name,
      fileHash,
      fileSize: file.size,
      encoding: parsed.encoding,
      targetEntity: 'CUSTOMER_CONTRACT',
      columnMappings: parsed.suggestedMapping as Prisma.InputJsonObject,
      status: 'DRAFT',
      totalRows: parsed.rows.length,
      importedById: ctx.userId,
      startedAt: new Date(),
    },
  });

  // 行データをステージングする
  const CHUNK = 1000;
  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const chunk = parsed.rows.slice(i, i + CHUNK);
    await prisma.importRow.createMany({
      data: chunk.map((raw, index) => ({
        batchId: batch.id,
        rowNumber: i + index + 1,
        raw: raw as Prisma.InputJsonObject,
        status: 'PENDING' as const,
      })),
    });
  }

  return {
    batchId: batch.id,
    fileName: file.name,
    encoding: parsed.encoding,
    headers: parsed.headers,
    totalRows: parsed.rows.length,
    suggestedMapping: parsed.suggestedMapping,
    duplicateOfBatch,
  };
}

/** バッチの取得（スコープ内のみ）。 */
export async function findBatch(ctx: AccessContext, batchId: string) {
  const scope = orgScope(ctx);
  return prisma.importBatch.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id: batchId }] },
    include: {
      importedBy: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
      agency: { select: { id: true, name: true } },
    },
  });
}

export async function listBatches(ctx: AccessContext, page = 1, pageSize = 30) {
  const scope = orgScope(ctx);
  const where = scope.organizationId ? { organizationId: scope.organizationId } : {};
  const [items, total] = await Promise.all([
    prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { importedBy: { select: { id: true, name: true } }, template: { select: { name: true } } },
    }),
    prisma.importBatch.count({ where }),
  ]);
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** 取込対象の列マッピング・オプションを保存する（STEP3）。 */
export async function saveBatchMapping(
  ctx: AccessContext,
  batchId: string,
  mappings: Record<string, string | null>,
  options: Record<string, unknown>,
  templateId?: string | null,
) {
  const batch = await findBatch(ctx, batchId);
  if (!batch) throw new DomainError('取込バッチが見つかりません。');
  if (batch.status === 'COMMITTED' || batch.status === 'ROLLED_BACK') {
    throw new DomainError('確定済みの取込は変更できません。');
  }

  return prisma.importBatch.update({
    where: { id: batchId },
    data: {
      columnMappings: mappings as Prisma.InputJsonObject,
      options: options as Prisma.InputJsonObject,
      templateId: templateId ?? null,
      status: 'VALIDATED',
    },
  });
}

export async function deleteDraftBatch(ctx: AccessContext, batchId: string) {
  const batch = await findBatch(ctx, batchId);
  if (!batch) throw new DomainError('取込バッチが見つかりません。');
  if (batch.status === 'COMMITTED') throw new DomainError('確定済みの取込は削除できません。ロールバックを使ってください。');
  await prisma.importBatch.delete({ where: { id: batchId } });
}
