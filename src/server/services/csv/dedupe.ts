/**
 * 重複判定（docs/07_CSV_IMPORT.md 7.5 / §9）。
 *
 * 優先順位:
 *   1. 契約番号        → 同一契約（更新）
 *   2. 外部顧客ID      → 同一顧客
 *   3. 電話番号 + 氏名 → 同一顧客の可能性が高い
 *   4. その他複合キー  → 重複候補（自動登録せず確認画面へ）
 */

export type MatchKey =
  | 'CONTRACT_NUMBER'
  | 'EXTERNAL_CUSTOMER_ID'
  | 'PHONE_AND_NAME'
  | 'PHONE_ONLY'
  | 'NAME_AND_BIRTHDATE'
  | 'NAME_AND_POSTAL';

export type DedupeDecision = 'CREATE' | 'UPDATE_CONTRACT' | 'ATTACH_TO_CUSTOMER' | 'NEEDS_REVIEW';

export interface DedupeCandidateSource {
  contractNumber?: string | null;
  externalCustomerId?: string | null;
  phoneNormalized?: string | null;
  name?: string | null;
  birthDate?: Date | null;
  postalCode?: string | null;
}

/** 既存データ側の索引。repository が organization/agency スコープ内でのみ構築する。 */
export interface ExistingIndex {
  byContractNumber: ReadonlyMap<string, { contractId: string; customerId: string }>;
  byExternalCustomerId: ReadonlyMap<string, string>;
  byPhoneAndName: ReadonlyMap<string, string>;
  byPhone: ReadonlyMap<string, readonly string[]>;
  byNameAndBirthDate: ReadonlyMap<string, string>;
  byNameAndPostal: ReadonlyMap<string, string>;
}

export interface DedupeResult {
  decision: DedupeDecision;
  matchedBy: MatchKey | null;
  customerId: string | null;
  contractId: string | null;
  /** 確認画面に出す理由（NEEDS_REVIEW のとき） */
  reason: string | null;
}

export function phoneNameKey(phone: string | null | undefined, name: string | null | undefined): string {
  return `${(phone ?? '').trim()}|${normalizeName(name)}`;
}

export function nameBirthKey(name: string | null | undefined, birthDate: Date | null | undefined): string {
  return `${normalizeName(name)}|${birthDate ? toDateKey(birthDate) : ''}`;
}

export function namePostalKey(name: string | null | undefined, postalCode: string | null | undefined): string {
  return `${normalizeName(name)}|${(postalCode ?? '').replace(/\D/g, '')}`;
}

export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.normalize('NFKC').replace(/[\s　]/g, '').toLowerCase();
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 1 行分の重複判定。
 * **完全一致（契約番号・外部顧客ID・電話+氏名）以外は自動登録しない。**
 */
export function decideDuplicate(source: DedupeCandidateSource, index: ExistingIndex): DedupeResult {
  // 1. 契約番号 — 同一契約とみなし更新する
  const contractNumber = source.contractNumber?.trim();
  if (contractNumber) {
    const hit = index.byContractNumber.get(contractNumber);
    if (hit) {
      return {
        decision: 'UPDATE_CONTRACT',
        matchedBy: 'CONTRACT_NUMBER',
        customerId: hit.customerId,
        contractId: hit.contractId,
        reason: null,
      };
    }
  }

  // 2. 外部顧客ID — 同一顧客。契約は新規で紐づける
  const externalId = source.externalCustomerId?.trim();
  if (externalId) {
    const customerId = index.byExternalCustomerId.get(externalId);
    if (customerId) {
      return {
        decision: 'ATTACH_TO_CUSTOMER',
        matchedBy: 'EXTERNAL_CUSTOMER_ID',
        customerId,
        contractId: null,
        reason: null,
      };
    }
  }

  // 3. 電話番号 + 氏名 — 同一顧客とみなす
  const phone = source.phoneNormalized?.trim();
  if (phone && source.name) {
    const customerId = index.byPhoneAndName.get(phoneNameKey(phone, source.name));
    if (customerId) {
      return {
        decision: 'ATTACH_TO_CUSTOMER',
        matchedBy: 'PHONE_AND_NAME',
        customerId,
        contractId: null,
        reason: null,
      };
    }
  }

  // 4. その他の複合キー — 自動登録せず確認画面へ
  if (phone) {
    const candidates = index.byPhone.get(phone);
    if (candidates && candidates.length > 0) {
      return {
        decision: 'NEEDS_REVIEW',
        matchedBy: 'PHONE_ONLY',
        customerId: candidates[0] ?? null,
        contractId: null,
        reason: '同じ電話番号の顧客が既に存在します。重複の可能性があります。',
      };
    }
  }
  if (source.name && source.birthDate) {
    const customerId = index.byNameAndBirthDate.get(nameBirthKey(source.name, source.birthDate));
    if (customerId) {
      return {
        decision: 'NEEDS_REVIEW',
        matchedBy: 'NAME_AND_BIRTHDATE',
        customerId,
        contractId: null,
        reason: '氏名と生年月日が一致する顧客が存在します。重複の可能性があります。',
      };
    }
  }
  if (source.name && source.postalCode) {
    const customerId = index.byNameAndPostal.get(namePostalKey(source.name, source.postalCode));
    if (customerId) {
      return {
        decision: 'NEEDS_REVIEW',
        matchedBy: 'NAME_AND_POSTAL',
        customerId,
        contractId: null,
        reason: '氏名と郵便番号が一致する顧客が存在します。重複の可能性があります。',
      };
    }
  }

  return { decision: 'CREATE', matchedBy: null, customerId: null, contractId: null, reason: null };
}

/** 空の索引（テスト・初回取込用）。 */
export function emptyIndex(): ExistingIndex {
  return {
    byContractNumber: new Map(),
    byExternalCustomerId: new Map(),
    byPhoneAndName: new Map(),
    byPhone: new Map(),
    byNameAndBirthDate: new Map(),
    byNameAndPostal: new Map(),
  };
}
