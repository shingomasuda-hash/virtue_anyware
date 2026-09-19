# 11. 経営管理・管理会計設計

## 11.1 分析単位（§39）

会社全体 / 年度 / 月 / 週 / 日 / 代理店 / 販売スタッフ / 催事 / 商業施設 / 店舗 / ブース /
商材 / 電力会社 / 契約 / 顧客 / アップセル商材

これを満たすため、fact テーブル（`contracts` / `revenues` / `expenses` /
`event_metrics` / `event_staff_shifts`）はすべて下記の dimension FK を持つ。

```
organization_id, agency_id, event_id, booth_id, facility_id(=event経由), staff_id,
product_id, supplier_id, customer_id, contract_id, 日付列
```

## 11.2 利益構造

```
売上高
 − 代理店支払
 ───────────
 = 売上総利益（販売粗利）
 − 催事費（ブース代・施設利用料・設営/撤去）
 − 人件費（社員・アルバイト・代理店人件費）
 − 交通費（新幹線・航空券・高速・ガソリン・駐車場・レンタカー）
 − 宿泊費
 − 販売促進費（販促物・印刷・景品）
 − その他経費
 ───────────
 = 営業利益相当額
```

## 11.3 催事別PL（§52）— 最重要

| 行 | 取得元 |
| --- | --- |
| 電力売上 | `Σ contracts(event, active).hq_revenue` |
| 代理店支払 | `Σ contracts(event, active).agency_payout` |
| 販売粗利 | 上記の差 |
| ブース代 | `booths.booth_fee + electricity_fee + fixture_fee + other_equipment_fee + setup_fee + teardown_fee` および `expenses(category=BOOTH)` |
| 人件費 | `Σ event_staff_shifts.labor_cost` + `expenses(category=LABOR)` |
| 交通費 / 宿泊費 / 販促費 / その他 | `expenses` のカテゴリ別 |
| **催事利益** | 販売粗利 − 催事経費合計 |

人件費は `staff_compensations` の**有効期間つき単価**から算出し、
シフト確定時に `event_staff_shifts.labor_cost` へ**スナップショット保存**する（§62）。
→ 後日の給与改定で過去催事の利益が変わらない。

## 11.4 ブース位置分析（§55–§57, §68）

分析キーは **施設 × ブース位置**（`facility_id` × `floor` × `area_name` × タグ集合）。
同一施設でも「1F 食品入口前」と「2F エスカレーター前」を別物として集計する。

ヒートマップは `facility × booth_position` のマトリクスに
`利益率 / ROI / CPA` を色階調（緑→黄→赤）でマップする。

## 11.5 曜日・時間帯分析（§58, §59）

- `contracts.contracted_at` から曜日（月〜日 + 祝日フラグ）を導出。
  祝日は `holidays` を持たず、`event_metrics.is_holiday` と日本の祝日判定ユーティリティで補う。
- 時間帯は `contracts.contracted_time`（nullable）と `event_metrics.hour_slot` を使用。
  2時間刻み（10-12 / 12-14 / 14-16 / 16-18 / 18-20 / 20-）を既定スロットとする。
- 取得できない催事は入力必須にしない（§54）。NULL は分析から除外し、母数に含めない。

## 11.6 原価配賦（§75）

`cost_allocations` により1件の経費を複数対象へ按分する。

| 按分基準 | 計算 |
| --- | --- |
| `CONTRACT_COUNT` | 対象期間の対象別契約件数の比率 |
| `REVENUE` | 対象別売上の比率 |
| `WORK_HOURS` | 対象別稼働時間の比率 |
| `MANUAL` | 手入力の比率 |

配賦後の金額は `cost_allocations.allocated_amount` に確定保存し、
按分元が後から変わっても過去の配賦結果は変えない。

## 11.7 管理会計と法定会計（§73, §74）

本システムの主目的は **日々の経営判断のための管理会計**。会計ソフトの代替ではない。
ただし `expenses` / `revenues` / `invoices` は `accounting_categories`
（勘定科目・補助科目・部門）と税区分を保持し、以下の列で会計CSVを出力できる。

```
日付, 取引先, 金額, 税区分, 勘定科目, 補助科目, 部門, 摘要
```

freee / マネーフォワード / 弥生 の各フォーマットへは
`src/server/services/accounting/exporters/*.ts` のアダプタで変換する設計とする
（PHASE 11。共通中間形式 `JournalRow` を定義済み）。

## 11.8 キャッシュフロー（§72）

売上計上（`revenues.recognized_on`）と入金（`receivables.paid_on`）、
費用計上（`expenses.incurred_on`）と支払（`payments.paid_on`）を分離して保持し、
`due_on` ベースで 30 / 60 / 90 日の入出金予測を表示する。

## 11.9 出店判断支援（§70）

現段階はルールベース。施設×ブース位置ごとに過去実績を集計し、
`平均契約数 / 平均利益 / 平均CPA / 平均ROI / 最良曜日 / 最良ブース / 最良時間帯 /
キャンセル率 / アップセル率` を提示する。

将来の AI 予測は `src/server/services/analytics/advisor.ts` の
`Advisor` インターフェース（`suggest(facilityId, params): Suggestion[]`）を
差し替えることで導入できる構造とする（§83）。
