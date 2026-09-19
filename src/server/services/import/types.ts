import type { MatchKey } from '@/server/services/csv/dedupe';

/** 行ごとの最終的な扱い。プレビューの色分けと 1:1 で対応する。 */
export type RowDecision = 'CREATE' | 'UPDATE' | 'DUPLICATE' | 'ERROR';

export type IssueLevel = 'error' | 'warning';

export interface RowIssue {
  level: IssueLevel;
  field: string | null;
  message: string;
}

export interface PlannedRow {
  rowNumber: number;
  raw: Record<string, string>;
  /** 正規化後の値（日付は ISO 文字列で保持し、そのまま JSON 化できるようにする） */
  values: Record<string, string | number | null>;
  decision: RowDecision;
  issues: RowIssue[];
  matchedBy: MatchKey | null;
  customerId: string | null;
  contractId: string | null;
  /** 解決済みの参照 ID（確定時に再解決しなくてよいようにする） */
  resolved: {
    agencyId: string | null;
    agencyLabel: string | null;
    statusId: string | null;
    statusLabel: string | null;
    supplierId: string | null;
    planId: string | null;
    productId: string | null;
    staffId: string | null;
    eventId: string | null;
    /** 使用量ベース算定の入力（検針月は未指定なら契約日の月で補完） */
    usageMonth: number | null;
    actualUsageKwh: number | null;
    hasStatement: boolean;
    isMatchingConfirmed: boolean;
  };
}

export interface ImportPlanSummary {
  totalRows: number;
  createCount: number;
  updateCount: number;
  duplicateCount: number;
  errorCount: number;
  warningCount: number;
}

export interface ImportPlan {
  batchId: string;
  summary: ImportPlanSummary;
  rows: PlannedRow[];
}

/** 取込オプション。テンプレートに保存して次回以降再利用する。 */
export interface ImportOptions {
  /** 代理店が CSV から解決できなかった場合の扱い */
  unknownAgency: 'error' | 'warning';
  /** 契約ステータスが解決できなかった場合に使う既定ステータスの code */
  defaultStatusCode: string | null;
  /** 取込先の代理店を固定する（CSV に代理店列が無い場合） */
  fixedAgencyId: string | null;
  /** 重複候補（NEEDS_REVIEW）を無視して新規登録するか */
  createOnReview: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  unknownAgency: 'error',
  defaultStatusCode: null,
  fixedAgencyId: null,
  createOnReview: false,
};

export function parseImportOptions(value: unknown): ImportOptions {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_IMPORT_OPTIONS };
  const raw = value as Record<string, unknown>;
  return {
    unknownAgency: raw.unknownAgency === 'warning' ? 'warning' : 'error',
    defaultStatusCode: typeof raw.defaultStatusCode === 'string' ? raw.defaultStatusCode : null,
    fixedAgencyId: typeof raw.fixedAgencyId === 'string' ? raw.fixedAgencyId : null,
    createOnReview: raw.createOnReview === true,
  };
}

export function parseColumnMappings(value: unknown): Record<string, string | null> {
  if (typeof value !== 'object' || value === null) return {};
  const result: Record<string, string | null> = {};
  for (const [key, mapped] of Object.entries(value as Record<string, unknown>)) {
    result[key] = typeof mapped === 'string' && mapped !== '' ? mapped : null;
  }
  return result;
}
