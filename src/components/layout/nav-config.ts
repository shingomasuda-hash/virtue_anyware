import type { Permission } from '@/server/authz/permissions';

export interface NavItem {
  label: string;
  href: string;
  /** 表示に必要な権限（UX 目的。真の防御はサーバー側）。 */
  permission?: Permission;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** 本部メニュー（§30）。未実装の PHASE は badge で明示する。 */
export const HQ_NAV: NavSection[] = [
  {
    title: '概況',
    items: [
      { label: 'ダッシュボード', href: '/dashboard', permission: 'report:read' },
      { label: '経営ダッシュボード', href: '/executive', permission: 'finance:hq', badge: 'P10' },
    ],
  },
  {
    title: '販売',
    items: [
      { label: '顧客', href: '/customers', permission: 'customer:read' },
      { label: '電力契約', href: '/contracts', permission: 'contract:read' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'アップセル', href: '/upsell', permission: 'upsell:read', badge: 'P5' },
      { label: 'トスアップ', href: '/tossups', permission: 'upsell:read', badge: 'P5' },
    ],
  },
  {
    title: '催事',
    items: [
      { label: '催事', href: '/events', permission: 'event:read', badge: 'P7' },
      { label: '施設', href: '/facilities', permission: 'event:read', badge: 'P7' },
    ],
  },
  {
    title: '代理店',
    items: [
      { label: '代理店', href: '/agencies', permission: 'agency:read' },
      { label: '精算', href: '/settlements', permission: 'settlement:read', badge: 'P6' },
    ],
  },
  {
    title: '会計',
    items: [
      { label: '売上', href: '/revenue', permission: 'finance:hq', badge: 'P3' },
      { label: '経費', href: '/expenses', permission: 'expense:read', badge: 'P8' },
    ],
  },
  {
    title: 'データ',
    items: [
      { label: 'CSVインポート', href: '/import', permission: 'import:run' },
      { label: 'レポート', href: '/reports', permission: 'report:read', badge: 'P9' },
    ],
  },
  {
    title: '管理',
    items: [
      { label: 'ユーザー', href: '/users', permission: 'user:manage' },
      { label: '単価マスタ', href: '/settings/pricing', permission: 'pricing:read' },
      { label: '監査ログ', href: '/settings/audit', permission: 'audit:read' },
    ],
  },
];

/** 代理店メニュー（§30）。本部売上・粗利へのリンクは存在しない。 */
export const AGENCY_NAV: NavSection[] = [
  {
    title: 'メニュー',
    items: [
      { label: 'ダッシュボード', href: '/agency/dashboard' },
      { label: '顧客', href: '/agency/customers', permission: 'customer:read' },
      { label: '契約', href: '/agency/contracts', permission: 'contract:read' },
      { label: '売上/精算', href: '/agency/settlements', permission: 'settlement:read', badge: 'P6' },
      { label: 'スタッフ', href: '/agency/staff', permission: 'agency:read', badge: 'P7' },
    ],
  },
];
