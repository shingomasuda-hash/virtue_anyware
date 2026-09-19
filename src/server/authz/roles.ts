import type { UserRole } from '@/generated/prisma';

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'システム管理者',
  HQ_ADMIN: 'VIRTUE本部管理者',
  HQ_STAFF: 'VIRTUE本部スタッフ',
  AGENCY_ADMIN: '代理店管理者',
  AGENCY_STAFF: '代理店スタッフ',
};

export const HQ_ROLES: readonly UserRole[] = ['SUPER_ADMIN', 'HQ_ADMIN', 'HQ_STAFF'] as const;
export const AGENCY_ROLES: readonly UserRole[] = ['AGENCY_ADMIN', 'AGENCY_STAFF'] as const;

export function isHqRole(role: UserRole): boolean {
  return HQ_ROLES.includes(role);
}

export function isAgencyRole(role: UserRole): boolean {
  return AGENCY_ROLES.includes(role);
}

export function isRole(value: string): value is UserRole {
  return value in ROLE_LABELS;
}
