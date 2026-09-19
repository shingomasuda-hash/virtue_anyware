import Encoding from 'encoding-japanese';

export type CsvEncoding = 'UTF-8' | 'SJIS' | 'UTF-8-BOM';

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/**
 * 文字コードを判定する（docs/07_CSV_IMPORT.md 7.2）。
 * 日本企業から届く CSV は Shift-JIS(CP932) が多いため、UTF-8 だけを前提にしない。
 */
export function detectEncoding(buffer: Uint8Array): CsvEncoding {
  if (buffer.length >= 3 && UTF8_BOM.every((b, i) => buffer[i] === b)) {
    return 'UTF-8-BOM';
  }
  const detected = Encoding.detect(buffer);
  if (detected === 'UTF8' || detected === 'ASCII') return 'UTF-8';
  return 'SJIS';
}

/** バイト列を文字列へ復号する。encoding 未指定なら自動判定。 */
export function decodeCsv(buffer: Uint8Array, encoding?: CsvEncoding | 'auto'): { text: string; encoding: CsvEncoding } {
  const resolved = !encoding || encoding === 'auto' ? detectEncoding(buffer) : encoding;

  if (resolved === 'UTF-8-BOM') {
    const body = buffer.subarray(3);
    return { text: new TextDecoder('utf-8').decode(body), encoding: resolved };
  }
  if (resolved === 'UTF-8') {
    return { text: new TextDecoder('utf-8').decode(buffer), encoding: resolved };
  }
  const unicodeArray = Encoding.convert(Array.from(buffer), { to: 'UNICODE', from: 'SJIS' });
  return { text: Encoding.codeToString(unicodeArray), encoding: 'SJIS' };
}
