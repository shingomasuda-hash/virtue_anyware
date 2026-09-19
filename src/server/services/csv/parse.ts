import Papa from 'papaparse';
import { decodeCsv, type CsvEncoding } from './encoding';
import {
  FIELD_BY_KEY,
  normalizeValue,
  suggestMapping,
  type FieldDefinition,
} from './field-catalog';

export interface ParsedCsv {
  encoding: CsvEncoding;
  headers: string[];
  rows: Array<Record<string, string>>;
  /** ヘッダ → システム項目キー の推測結果（STEP3 の初期値） */
  suggestedMapping: Record<string, string | null>;
}

/** STEP2: CSV 解析。DB へは一切書き込まない。 */
export function parseCsv(buffer: Uint8Array, encoding?: CsvEncoding | 'auto'): ParsedCsv {
  const decoded = decodeCsv(buffer, encoding);
  const result = Papa.parse<Record<string, string>>(decoded.text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().replace(/^﻿/, ''),
  });

  const headers = result.meta.fields ?? [];
  return {
    encoding: decoded.encoding,
    headers,
    rows: result.data.filter((r) => Object.values(r).some((v) => v !== null && String(v).trim() !== '')),
    suggestedMapping: suggestMapping(headers),
  };
}

export interface NormalizedRow {
  rowNumber: number;
  raw: Record<string, string>;
  values: Record<string, string | number | Date | null>;
  errors: string[];
}

/**
 * STEP4/5: マッピングを適用して値を正規化し、行ごとのエラーを収集する。
 * ここでも DB へは書き込まない。
 */
export function normalizeRows(
  rows: readonly Record<string, string>[],
  mapping: Readonly<Record<string, string | null>>,
): NormalizedRow[] {
  const pairs: Array<[string, FieldDefinition]> = [];
  for (const [header, fieldKey] of Object.entries(mapping)) {
    if (!fieldKey) continue;
    const field = FIELD_BY_KEY.get(fieldKey);
    if (field) pairs.push([header, field]);
  }

  return rows.map((raw, index) => {
    const values: Record<string, string | number | Date | null> = {};
    const errors: string[] = [];

    for (const [header, field] of pairs) {
      const { value, error } = normalizeValue(field, raw[header]);
      values[field.key] = value;
      if (error) errors.push(error);
    }

    for (const field of FIELD_BY_KEY.values()) {
      if (field.required && values[field.key] === undefined) {
        errors.push(`${field.label} の列がマッピングされていません。`);
      }
    }

    return { rowNumber: index + 1, raw, values, errors };
  });
}
