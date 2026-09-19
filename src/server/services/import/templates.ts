import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { DomainError } from '@/lib/errors';
import { parseColumnMappings, parseImportOptions } from './types';

/** 取込テンプレート（§7）。一度作った列マッピングを保存して再利用する。 */
export async function listTemplates(ctx: AccessContext) {
  const scope = orgScope(ctx);
  return prisma.csvTemplate.findMany({
    where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { batches: true } } },
  });
}

export async function findTemplate(ctx: AccessContext, id: string) {
  const scope = orgScope(ctx);
  const template = await prisma.csvTemplate.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id }] },
  });
  if (!template) return null;
  return {
    ...template,
    columnMappings: parseColumnMappings(template.columnMappings),
    options: parseImportOptions(template.defaultValues),
  };
}

export async function saveTemplate(
  ctx: AccessContext,
  input: {
    id?: string | null;
    name: string;
    description?: string | null;
    columnMappings: Record<string, string | null>;
    options: Record<string, unknown>;
  },
) {
  const scope = orgScope(ctx);
  const organizationId = scope.organizationId ?? ctx.organizationId;
  if (!organizationId) throw new DomainError('組織が特定できません。');

  const data = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    columnMappings: input.columnMappings as Prisma.InputJsonObject,
    defaultValues: input.options as Prisma.InputJsonObject,
    targetEntity: 'CUSTOMER_CONTRACT' as const,
  };

  if (input.id) {
    const existing = await prisma.csvTemplate.findFirst({
      where: { AND: [{ organizationId }, { id: input.id }] },
      select: { id: true },
    });
    if (!existing) throw new DomainError('テンプレートが見つかりません。');
    return prisma.csvTemplate.update({ where: { id: input.id }, data });
  }

  const duplicate = await prisma.csvTemplate.findFirst({
    where: { organizationId, name: data.name },
    select: { id: true },
  });
  if (duplicate) {
    // 同名テンプレートは上書きする（運用上、同じ CSV 種別を何度も保存するため）
    return prisma.csvTemplate.update({ where: { id: duplicate.id }, data });
  }

  return prisma.csvTemplate.create({ data: { ...data, organizationId } });
}

export async function deleteTemplate(ctx: AccessContext, id: string) {
  const scope = orgScope(ctx);
  const template = await prisma.csvTemplate.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id }] },
    select: { id: true },
  });
  if (!template) throw new DomainError('テンプレートが見つかりません。');
  await prisma.csvTemplate.update({ where: { id }, data: { isActive: false } });
}
