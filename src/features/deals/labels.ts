import type {
  CompensationPaymentStatus,
  ConstructionState,
  DealPaymentStatus,
  DealPriority,
  DealProductType,
  DealStage,
  LoanReviewState,
  PaymentMethod,
  ProgressState,
  SiteSurveyState,
  SubsidyState,
} from '@/generated/prisma';

/**
 * 案件管理の表示ラベル。
 * 現行スプレッドシートの語をそのまま使い、移行時に見え方が変わらないようにする。
 */

export const DEAL_PRODUCT_TYPE_LABELS: Record<DealProductType, string> = {
  PV: '太陽光',
  BT: '蓄電池',
  EQ: '設備',
  IH: 'IH',
};

export const DEAL_PRIORITY_LABELS: Record<DealPriority, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  APPOINTMENT: 'アポ',
  MEETING: '商談',
  PROPOSAL: '提案',
  CONTRACT: '契約',
  SCREENING: '審査',
  SURVEY: '現調',
  CONSTRUCTION: '工事',
  COMPLETED: '完工',
  LOST: '失注',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: '現金',
  BANK_TRANSFER: '銀行',
  INSTALLMENT: '信販',
  CREDIT_CARD: 'クレジットカード',
  E_MONEY: '電子マネー',
  OTHER: 'その他',
};

/** 案件で選べる支払方法（シートの 現金 / 銀行 / 信販）。 */
export const DEAL_PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'INSTALLMENT'];

export const LOAN_REVIEW_LABELS: Record<LoanReviewState, string> = {
  NOT_STARTED: '未対応',
  IN_PROGRESS: '対応中',
  PRE_APPROVED: '仮審査済',
  MAIN_SCREENING: '本審査中',
  MAIN_APPROVED: '本審査済',
  REJECTED: '否決',
  NOT_REQUIRED: '不要',
};

export const SITE_SURVEY_LABELS: Record<SiteSurveyState, string> = {
  NOT_STARTED: '未対応',
  SCHEDULING: '日程調整中',
  SCHEDULED: '予定',
  DONE: '完了',
  NOT_REQUIRED: '不要',
};

export const SUBSIDY_LABELS: Record<SubsidyState, string> = {
  NOT_REQUIRED: '不要',
  CHECKING: '確認中',
  PLANNED: '申請予定',
  APPLIED: '申請済',
  APPROVED: '交付決定',
  REJECTED: '却下',
};

export const CONSTRUCTION_LABELS: Record<ConstructionState, string> = {
  NOT_STARTED: '未対応',
  ARRANGING: '手配中',
  ARRANGED: '手配済',
  IN_PROGRESS: '着工',
  DONE: '完了',
};

export const PROGRESS_LABELS: Record<ProgressState, string> = {
  NOT_STARTED: '未対応',
  IN_PROGRESS: '対応中',
  DONE: '完了',
  NOT_REQUIRED: '不要',
};

export const DEAL_PAYMENT_STATUS_LABELS: Record<DealPaymentStatus, string> = {
  PENDING: '入金待ち',
  PARTIAL: '一部入金',
  PAID: '入金済',
};

export const COMPENSATION_PAYMENT_STATUS_LABELS: Record<CompensationPaymentStatus, string> = {
  PENDING: '支払待ち',
  PAID: '支払済',
  ON_HOLD: '保留',
};

/** 「未対応 / 対応中」系は注意喚起として色を付けたいので、完了かどうかを判定する。 */
export function isSettled(state: ProgressState): boolean {
  return state === 'DONE' || state === 'NOT_REQUIRED';
}

/** `<select>` 用の選択肢へ変換する。 */
export function optionsOf<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}
