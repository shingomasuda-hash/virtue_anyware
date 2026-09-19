import type { UserRole } from '@/generated/prisma';

/**
 * パーミッション一覧。docs/04_RBAC.md 4.2 の表と 1:1 対応する。
 * 画面の出し分けもここを唯一のソースにする。
 */
export const PERMISSIONS = [
  'org:manage',
  'user:manage',
  'agency:read',
  'agency:write',
  'customer:read',
  'customer:write',
  'contract:read',
  'contract:write',
  'pricing:read',
  'pricing:write',
  'import:run',
  'import:manage',
  'finance:hq',
  'finance:agencyPayout',
  'settlement:read',
  'settlement:write',
  'expense:read',
  'expense:write',
  'expense:approve',
  'event:read',
  'event:write',
  'upsell:read',
  'upsell:write',
  'report:read',
  'audit:read',
  'export:csv',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const HQ_STAFF_PERMISSIONS: readonly Permission[] = [
  'agency:read',
  'customer:read',
  'customer:write',
  'contract:read',
  'contract:write',
  'pricing:read',
  'finance:hq',
  'finance:agencyPayout',
  'settlement:read',
  'expense:read',
  'expense:write',
  'event:read',
  'upsell:read',
  'upsell:write',
  'report:read',
];

const HQ_ADMIN_PERMISSIONS: readonly Permission[] = [
  ...HQ_STAFF_PERMISSIONS,
  'user:manage',
  'agency:write',
  'pricing:write',
  'import:run',
  'import:manage',
  'settlement:write',
  'expense:approve',
  'event:write',
  'audit:read',
  'export:csv',
];

/**
 * 代理店ロールには finance:hq を**絶対に含めない**。
 * 本部単価・本部売上・粗利は代理店から見えてはならない（§17）。
 */
const AGENCY_ADMIN_PERMISSIONS: readonly Permission[] = [
  'agency:read',
  'customer:read',
  'customer:write',
  'contract:read',
  'finance:agencyPayout',
  'settlement:read',
  'expense:read',
  'expense:write',
  'event:read',
  'report:read',
  'export:csv',
];

const AGENCY_STAFF_PERMISSIONS: readonly Permission[] = [
  'customer:read',
  'customer:write',
  'contract:read',
  'event:read',
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  HQ_ADMIN: HQ_ADMIN_PERMISSIONS,
  HQ_STAFF: HQ_STAFF_PERMISSIONS,
  AGENCY_ADMIN: AGENCY_ADMIN_PERMISSIONS,
  AGENCY_STAFF: AGENCY_STAFF_PERMISSIONS,
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
