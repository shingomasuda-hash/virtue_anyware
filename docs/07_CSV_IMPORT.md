# 07. CSVインポート処理フロー

## 7.1 6ステップフロー（§7）

```
STEP1 ファイルアップロード   … D&D。拡張子/サイズ/MIME 検証。ハッシュ(SHA-256)算出
   ↓
STEP2 CSV解析               … 文字コード自動判定(UTF-8 BOM / UTF-8 / Shift-JIS(CP932))
                               → papaparse でヘッダ+先頭200行をプレビュー用に保持
   ↓
STEP3 列マッピング           … CSVヘッダ → システム項目。自動推測 + 手動修正
                               テンプレート読込 / 新規テンプレート保存
   ↓
STEP4 プレビュー             … 変換後の値（正規化済み）を20行表示。新規/更新/重複の判定結果つき
   ↓
STEP5 エラー確認             … 行単位のバリデーションエラー一覧。CSVでダウンロード可
   ↓
STEP6 インポート確定         … トランザクションで一括登録。import_batch / import_rows を記録
```

- STEP1〜5 の間 DB には**確定登録しない**。中間状態は `import_batches.status = DRAFT` と
  `import_rows`（`status = PENDING`）に保持する。
- 確定時に `status = COMMITTED`。ロールバックは `import_rows` が持つ
  `customer_id` / `contract_id` と `created_by_batch` フラグを使い、
  **そのバッチで新規作成されたレコードのみ**削除（更新行は `before` スナップショットから復元）。

## 7.2 文字コード判定

```
1. 先頭3バイトが EF BB BF → UTF-8 (BOM)
2. バイト列を UTF-8 として厳密デコード → 成功なら UTF-8
3. 失敗 → CP932(Shift-JIS) としてデコード（encoding-japanese）
4. ユーザーが STEP2 で手動上書き可能
```

## 7.3 列マッピング自動推測

正規化キー（記号・空白・全角半角・大小文字を無視）で候補表を引く。

| システム項目 | 想定ヘッダ例 |
| --- | --- |
| `customerName` | 顧客名 / 契約者名 / お名前 / 氏名 / customer_name / NAME / CustomerName |
| `customerNameKana` | 氏名カナ / フリガナ / カナ / kana |
| `phone` | 電話番号 / TEL / 連絡先 / phone |
| `contractNumber` | 契約番号 / 申込番号 / 受付番号 / contract_no |
| `contractWatt` | 契約ワット数 / W数 / ワット / watt / kW※1000倍換算 |
| `unitPrice` | 単価 / 円/W / unit_price |
| `contractedAt` | 契約日 / 申込日 / contract_date |
| … | `docs` ではなく `src/server/services/csv/field-catalog.ts` を正とする |

推測結果は必ず STEP3 でユーザーが確認・修正できる。

## 7.4 取込項目（§8）

`field-catalog.ts` に定義。顧客系: 顧客ID/契約番号/氏名/氏名カナ/電話/メール/郵便番号/
都道府県/住所/建物名/生年月日。契約系: 契約日/申込日/開通日/電力会社/契約プラン/
契約ワット数/単価/代理店/担当者/催事会場/キャンペーン/ステータス/備考。

各項目に `type`(string/number/date/phone/postal/enum)・`required`・`normalizer`・`validator` を定義。

## 7.5 重複チェック（§9）

優先順位で候補を探索し、**完全一致以外は自動登録しない**。

| 優先 | キー | 判定 |
| --- | --- | --- |
| 1 | `contractNumber` | 一致 → **同一契約**（更新対象） |
| 2 | `externalCustomerId` | 一致 → **同一顧客**（契約は新規追加の可能性） |
| 3 | `phoneNormalized` + `name` | 一致 → 同一顧客の可能性が高い（自動更新可、設定で切替） |
| 4 | `phoneNormalized` のみ / `name`+`birthDate` / `name`+`postalCode` | **重複候補** → `NEEDS_REVIEW` |

`NEEDS_REVIEW` の行は STEP5 の確認画面に「重複の可能性があります」と表示し、
ユーザーが 行ごとに「新規として登録 / 既存に統合 / スキップ」を選ぶ。

同一ファイルの再アップロードは `file_hash` が一致した時点で警告し、
かつ行レベルでも契約番号重複により二重登録されない（§35 のテスト対象）。

## 7.6 取込履歴（§10）

`import_batches` に 取込日時 / ユーザー / ファイル名 / 総行数 / 成功 / 失敗 / 新規 / 更新 / 重複 を保存。
詳細画面では `import_rows` を状態別にフィルタして確認できる。
`ROLLED_BACK` にすると当該バッチ由来のデータを取り消す。
