import { describe, expect, it } from 'vitest';
import Encoding from 'encoding-japanese';
import { detectEncoding, decodeCsv } from '@/server/services/csv/encoding';
import { parseCsv, normalizeRows } from '@/server/services/csv/parse';
import { normalizeNumber, normalizePhone, normalizePostalCode, suggestFieldKey, suggestMapping } from '@/server/services/csv/field-catalog';

const CSV_UTF8 = `顧客名,電話番号,契約番号,契約ワット数,契約日\n山田 太郎,090-1234-5678,C-0001,5000,2026/07/10\n佐藤 花子,08098765432,C-0002,4,500,2026-07-11\n`;

function toSjis(text: string): Uint8Array {
  const unicode = Encoding.stringToCode(text);
  return new Uint8Array(Encoding.convert(unicode, { to: 'SJIS', from: 'UNICODE' }));
}

describe('文字コード判定（§2 Shift-JIS 対応）', () => {
  it('UTF-8 の CSV をそのまま読める', () => {
    const buffer = new TextEncoder().encode(CSV_UTF8);
    expect(detectEncoding(buffer)).toBe('UTF-8');
    expect(decodeCsv(buffer).text).toContain('山田 太郎');
  });

  it('UTF-8 BOM 付き CSV から BOM を取り除く', () => {
    const buffer = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(CSV_UTF8)]);
    expect(detectEncoding(buffer)).toBe('UTF-8-BOM');
    expect(decodeCsv(buffer).text.startsWith('顧客名')).toBe(true);
  });

  it('Shift-JIS(CP932) の CSV を自動判定して復号する', () => {
    const buffer = toSjis(CSV_UTF8);
    expect(detectEncoding(buffer)).toBe('SJIS');
    const decoded = decodeCsv(buffer);
    expect(decoded.encoding).toBe('SJIS');
    expect(decoded.text).toContain('佐藤 花子');
  });
});

describe('列マッピング推測（§7 STEP3）', () => {
  it('日本語・英語・スネークケースなど表記ゆれを同じ項目へ紐付ける', () => {
    for (const header of ['顧客名', '契約者名', 'customer_name', 'NAME', 'お名前', ' 氏 名 ']) {
      expect(suggestFieldKey(header)).toBe('customerName');
    }
    expect(suggestFieldKey('TEL')).toBe('phone');
    expect(suggestFieldKey('契約No')).toBe('contractNumber');
    expect(suggestFieldKey('W数')).toBe('contractWatt');
  });

  it('未知のヘッダは null（ユーザーが STEP3 で手動指定する）', () => {
    expect(suggestFieldKey('謎の列')).toBeNull();
  });

  it('同じ項目に複数ヘッダが当たった場合、最初の1つだけを採用する', () => {
    const mapping = suggestMapping(['顧客名', '契約者名', '電話番号']);
    expect(mapping['顧客名']).toBe('customerName');
    expect(mapping['契約者名']).toBeNull();
    expect(mapping['電話番号']).toBe('phone');
  });
});

describe('値の正規化', () => {
  it('電話番号は数字のみへ正規化する（重複判定キー）', () => {
    expect(normalizePhone('090-1234-5678')).toBe('09012345678');
    expect(normalizePhone('０９０１２３４５６７８')).toBe('09012345678');
    expect(normalizePhone('')).toBeNull();
  });

  it('郵便番号はハイフン付きへ揃える', () => {
    expect(normalizePostalCode('2618535')).toBe('261-8535');
    expect(normalizePostalCode('261-8535')).toBe('261-8535');
  });

  it('ワット数はカンマ・単位・kW 表記を吸収する', () => {
    expect(normalizeNumber('5,000')).toBe(5000);
    expect(normalizeNumber('5000W')).toBe(5000);
    expect(normalizeNumber('5kW')).toBe(5000);
    expect(normalizeNumber('あいうえお')).toBeNull();
  });
});

describe('CSV 解析と行の正規化（§7 STEP2/STEP4）', () => {
  it('ヘッダを読み取り、マッピング候補を返す', () => {
    const parsed = parseCsv(new TextEncoder().encode(CSV_UTF8));
    expect(parsed.headers).toEqual(['顧客名', '電話番号', '契約番号', '契約ワット数', '契約日']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.suggestedMapping['契約ワット数']).toBe('contractWatt');
  });

  it('日付・数値・電話番号を正規化し、行ごとのエラーを収集する', () => {
    const parsed = parseCsv(new TextEncoder().encode(
      '顧客名,電話番号,契約ワット数,契約日\n山田 太郎,090-1234-5678,5000,2026/07/10\n,08011112222,abc,不明\n',
    ));
    const rows = normalizeRows(parsed.rows, parsed.suggestedMapping);

    expect(rows[0]?.errors).toEqual([]);
    expect(rows[0]?.values.contractWatt).toBe(5000);
    expect(rows[0]?.values.phone).toBe('09012345678');
    expect((rows[0]?.values.contractedAt as Date).getFullYear()).toBe(2026);

    // 氏名必須・数値不正・日付不正の 3 件を検出する
    expect(rows[1]?.errors).toHaveLength(3);
    expect(rows[1]?.errors.some((e) => e.includes('氏名'))).toBe(true);
  });

  it('マッピングされていない列は無視する（STEP3 でユーザーが決めた列のみ取り込む）', () => {
    const parsed = parseCsv(new TextEncoder().encode('顧客名,社内メモ\n山田 太郎,無視される\n'));
    const rows = normalizeRows(parsed.rows, { 顧客名: 'customerName', 社内メモ: null });
    expect(rows[0]?.values).toEqual({ customerName: '山田 太郎' });
  });
});
