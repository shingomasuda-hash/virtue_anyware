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


---

# PHASE 2 実装メモ（2026-09 実装完了分）

## 7.7 実装の全体像

| ステップ | 画面 / API | サーバー処理 | DB への書き込み |
| --- | --- | --- | --- |
| STEP1 アップロード | `/import` → `POST /api/import/upload` | `uploadCsv()` | `import_batches`(DRAFT) + `import_rows`(PENDING) のみ |
| STEP2 CSV解析 | `/import/{batchId}` | `parseCsv()` | なし（STEP1 で解析済み） |
| STEP3 列マッピング | `/import/{batchId}` | `saveBatchMapping()` | `import_batches.columnMappings` / `options` |
| STEP4 プレビュー | `/import/{batchId}/preview` | `planImport()` | **なし** |
| STEP5 エラー・重複確認 | 同上（フィルタ切替） | `planImport()` | **なし** |
| STEP6 インポート確定 | 同上 | `commitImport()` | 顧客・契約・スナップショット・履歴 |

**重要**: STEP4 / STEP5 / STEP6 はすべて同じ `planImport()` の結果を使う。
そのため「プレビューでは成功していたのに確定で失敗する」が構造的に起きない。

## 7.8 DRY RUN

`planImport()` が DRY RUN の本体で、**業務データへは一切書き込まない**。
返すのは以下の件数と、行ごとの判定・指摘事項。

```
totalRows / createCount / updateCount / duplicateCount / errorCount / warningCount
```

画面の「DRY RUN を実行」ボタンで何度でも試算できる。

## 7.9 バリデーション

| 項目 | 検査 | レベル |
| --- | --- | --- |
| 氏名 | 空でないこと | エラー |
| 契約番号 | 64 文字以内 / 顧客ID・電話番号と合わせて突合キーが 1 つ以上あること | エラー |
| 電話番号 | `0` 始まり 10-11 桁 | 警告 |
| ワット数 | 数値であること / 0 より大きいこと | エラー |
| ワット数 | 1,000,000 W 超 | 警告 |
| 契約日 | 契約日か申込日のどちらかが解釈できること | エラー |
| 各日付 | 年が 1900–2100 の範囲であること | 警告 |
| 代理店 | マスタに存在すること（`unknownAgency` で エラー/警告 を切替） | エラー（既定） |
| 契約ステータス | マスタに存在するか、既定ステータスが設定されていること | エラー |
| 単価 | CSV の値が単価マスタと一致すること | 警告（金額はマスタを正とする） |

型レベルの検査（「数値項目に文字が入っている」等）は `csv/field-catalog.ts` の
`normalizeValue()` が行い、上表はその後の業務検査。

## 7.10 プレビューの色分け

| 判定 | 色 | 意味 |
| --- | --- | --- |
| 新規登録 | 緑 | 既存データと突合せず、新しく作成する |
| 更新 | 青 | 契約番号が一致したため既存契約を更新する |
| 重複 | 黄 | 完全一致ではないため自動登録しない（要確認） |
| エラー | 赤 | 取り込まない。理由を行ごとに表示 |
| 警告 | 黄（行内バッジ） | 取り込むが確認が必要 |

既定で 50 行表示し、「さらに 100 行を表示」で追加読み込みする。
判定ごとのフィルタタブで、エラー行・重複行だけを抽出できる。

## 7.11 ロールバックの安全設計

`rollbackImport()` は **取込後に人が変更したデータを巻き戻さない**。

判定方法:

1. 取込確定時に、各行の `customerUpdatedAt` / `contractUpdatedAt`（確定直後の `updatedAt`）を記録する。
2. ロールバック時に現在の `updatedAt` と比較し、**異なればスキップ**する。
3. 加えて以下もスキップする。
   - 売上（`revenues`）または精算明細（`settlement_items`）が紐づいた契約
   - この取込以外の契約がぶら下がっている顧客
   - 復元用スナップショットが無い行

処理内容:

| 行の種類 | 処理 |
| --- | --- |
| このバッチが新規作成した | 論理削除（`deletedAt` を設定。物理削除しない） |
| このバッチが更新した | `beforeSnapshot` から取込前の値へ復元 |
| スキップ対象 | 何もせず、理由を画面へ表示 |

スキップした行は件数と理由が画面に表示されるため、
「何が巻き戻され、何が残ったか」が必ず分かる。

## 7.12 列マッピングを特定 CSV に固定しない設計

CSV 側の列名がどうであれ、`src/server/services/csv/field-catalog.ts` の
`aliases` に候補を追加するだけで自動推測が効く。推測に失敗しても STEP3 で手動指定できる。

実装済みの例:

```
「氏名」「顧客名」「契約者名」「お名前」「customer_name」「NAME」 → customerName
「契約ワット数」「ワット数」「W数」「KW」「kW」「契約容量」「容量」「capacity」 → contractWatt
「契約番号」「申込番号」「受付番号」「contract_no」 → contractNumber
```

値の正規化も吸収する: `5kW` → `5000` / `"6,500"` → `6500` / `7200W` → `7200`。

## 7.13 取込テンプレート

`csv_templates` に列マッピングと取込オプションを保存し、次回以降に適用できる。
テンプレート読込時は、**今回の CSV に実在する列だけ**を反映する
（列構成が変わっても壊れない）。同名テンプレートは上書き保存される。
