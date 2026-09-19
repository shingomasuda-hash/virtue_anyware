import { describe, expect, it } from 'vitest';
import {
  decideDuplicate,
  emptyIndex,
  nameBirthKey,
  namePostalKey,
  phoneNameKey,
  type ExistingIndex,
} from '@/server/services/csv/dedupe';

function indexWith(overrides: Partial<ExistingIndex>): ExistingIndex {
  return { ...emptyIndex(), ...overrides };
}

describe('重複チェック（§9 / docs/07_CSV_IMPORT.md 7.5）', () => {
  it('既存データが無ければ新規登録する', () => {
    const result = decideDuplicate({ contractNumber: 'C-0001', name: '山田 太郎' }, emptyIndex());
    expect(result.decision).toBe('CREATE');
    expect(result.matchedBy).toBeNull();
  });

  it('優先度1: 契約番号が一致したら同一契約として更新する（二重登録しない）', () => {
    const index = indexWith({
      byContractNumber: new Map([['C-0001', { contractId: 'ct1', customerId: 'cu1' }]]),
    });
    const result = decideDuplicate({ contractNumber: 'C-0001', name: '山田 太郎' }, index);

    expect(result.decision).toBe('UPDATE_CONTRACT');
    expect(result.matchedBy).toBe('CONTRACT_NUMBER');
    expect(result.contractId).toBe('ct1');
  });

  it('§35: 同一CSVを再アップロードしても契約が二重登録されない', () => {
    const rows = [
      { contractNumber: 'C-0001', name: '山田 太郎', phoneNormalized: '09011112222' },
      { contractNumber: 'C-0002', name: '佐藤 花子', phoneNormalized: '09033334444' },
    ];

    // 1回目: すべて新規
    const first = rows.map((r) => decideDuplicate(r, emptyIndex()));
    expect(first.every((r) => r.decision === 'CREATE')).toBe(true);

    // 1回目の取込結果を索引へ反映
    const index = indexWith({
      byContractNumber: new Map(
        rows.map((r, i) => [r.contractNumber, { contractId: `ct${i}`, customerId: `cu${i}` }]),
      ),
      byPhoneAndName: new Map(rows.map((r, i) => [phoneNameKey(r.phoneNormalized, r.name), `cu${i}`])),
    });

    // 2回目: 同じファイル → 1件も新規作成されない
    const second = rows.map((r) => decideDuplicate(r, index));
    expect(second.every((r) => r.decision === 'UPDATE_CONTRACT')).toBe(true);
    expect(second.some((r) => r.decision === 'CREATE')).toBe(false);
  });

  it('優先度2: 外部顧客IDが一致したら既存顧客へ契約を追加する', () => {
    const index = indexWith({ byExternalCustomerId: new Map([['EX-1', 'cu1']]) });
    const result = decideDuplicate({ externalCustomerId: 'EX-1', name: '山田 太郎' }, index);

    expect(result.decision).toBe('ATTACH_TO_CUSTOMER');
    expect(result.matchedBy).toBe('EXTERNAL_CUSTOMER_ID');
    expect(result.customerId).toBe('cu1');
  });

  it('優先度3: 電話番号＋氏名が一致したら同一顧客とみなす', () => {
    const index = indexWith({
      byPhoneAndName: new Map([[phoneNameKey('09011112222', '山田 太郎'), 'cu9']]),
    });
    const result = decideDuplicate({ phoneNormalized: '09011112222', name: '山田　太郎' }, index);

    expect(result.decision).toBe('ATTACH_TO_CUSTOMER');
    expect(result.matchedBy).toBe('PHONE_AND_NAME');
  });

  it('優先度4: 電話番号のみ一致は自動登録せず「重複の可能性」として確認画面へ送る', () => {
    const index = indexWith({ byPhone: new Map([['09011112222', ['cu1']]]) });
    const result = decideDuplicate({ phoneNormalized: '09011112222', name: '別人 太郎' }, index);

    expect(result.decision).toBe('NEEDS_REVIEW');
    expect(result.matchedBy).toBe('PHONE_ONLY');
    expect(result.reason).toContain('重複の可能性');
  });

  it('氏名＋生年月日 / 氏名＋郵便番号の一致も確認対象にする', () => {
    const birthDate = new Date(1985, 4, 20);
    const byBirth = indexWith({ byNameAndBirthDate: new Map([[nameBirthKey('山田 太郎', birthDate), 'cu2']]) });
    expect(decideDuplicate({ name: '山田 太郎', birthDate }, byBirth).decision).toBe('NEEDS_REVIEW');

    const byPostal = indexWith({ byNameAndPostal: new Map([[namePostalKey('山田 太郎', '261-8535'), 'cu3']]) });
    expect(decideDuplicate({ name: '山田 太郎', postalCode: '2618535' }, byPostal).decision).toBe('NEEDS_REVIEW');
  });

  it('契約番号一致は外部顧客IDより優先される', () => {
    const index = indexWith({
      byContractNumber: new Map([['C-0001', { contractId: 'ct1', customerId: 'cu1' }]]),
      byExternalCustomerId: new Map([['EX-1', 'cu2']]),
    });
    const result = decideDuplicate({ contractNumber: 'C-0001', externalCustomerId: 'EX-1' }, index);
    expect(result.matchedBy).toBe('CONTRACT_NUMBER');
  });
});
