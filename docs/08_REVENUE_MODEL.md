# 08. 収益計算ロジック

## 8.1 基本式（§6）

```
hq_revenue       = contract_watt × hq_unit_price          … VIRTUE売上（上位会社からの受取）
agency_payout    = contract_watt × agency_unit_price      … 代理店への支払
hq_gross_profit  = hq_revenue − agency_payout             … VIRTUE粗利
gross_margin     = hq_gross_profit ÷ hq_revenue           … 粗利率（hq_revenue = 0 のとき 0）
```

### 検証例（§35）
| 項目 | 値 |
| --- | --- |
| contract_watt | 5,000 W |
| hq_unit_price | 150 円/W |
| agency_unit_price | 100 円/W |
| **hq_revenue** | **750,000 円** |
| **agency_payout** | **500,000 円** |
| **hq_gross_profit** | **250,000 円** |
| **gross_margin** | **33.33 %** |

## 8.2 計算式を差し替え可能にする設計

単価は `pricing_rules.unit_type` で意味が変わる。計算器は `unit_type` ごとの
ストラテジ関数として `src/server/services/pricing/strategies.ts` に定義する。

| unit_type | 計算 | 用途 |
| --- | --- | --- |
| `PER_WATT` | `quantity(W) × unitPrice` | 電力 |
| `PER_CONTRACT` | `unitPrice`（1件あたり定額） | 通信・ウォーターサーバー等 |
| `PERCENT_OF_AMOUNT` | `baseAmount × rate` | 太陽光紹介料（販売額の◯%） |
| `FIXED` | `unitPrice` | 固定報酬 |

`calcContractAmounts()` は `{ quantity, baseAmount, hqRule, agencyRule }` を受け取り、
上記ストラテジで `hqRevenue` / `agencyPayout` を求め、粗利を導出する。
将来商流が変わる場合は **ストラテジ追加のみ**で対応し、呼び出し側は変更しない。

## 8.3 単価の解決（`resolvePricingRule`）

`pricing_rules` から以下の条件で最も具体的な1件を選ぶ。

```
WHERE organization_id = :org
  AND side            = :side            -- HQ_RECEIVE | AGENCY_PAYOUT
  AND (agency_id  = :agency  OR agency_id  IS NULL)
  AND (product_id = :product OR product_id IS NULL)
  AND (supplier_id= :supplier OR supplier_id IS NULL)
  AND (plan_id    = :plan    OR plan_id    IS NULL)
  AND effective_from <= :基準日
  AND (effective_to IS NULL OR effective_to >= :基準日)
ORDER BY specificity DESC, priority DESC, effective_from DESC
LIMIT 1
```

`specificity` = 一致した非NULLスコープ数（agency/product/supplier/plan）。
基準日は **契約日（`contracted_at` 無ければ `applied_at`）**。

代理店支払単価は `agency_unit_prices`（代理店マスタ側の履歴、§5）が存在すればそれを優先し、
無ければ `pricing_rules(side=AGENCY_PAYOUT)` にフォールバックする。

## 8.4 スナップショット原則（§6 最重要）

契約の作成・確定時に `calcContractAmounts()` の結果を `contracts` の
`hq_unit_price / agency_unit_price / hq_revenue / agency_payout / hq_gross_profit / gross_margin`
に書き込み、`contract_pricing_snapshots` に計算根拠（適用した rule id・基準日・計算前後）を残す。

- **以後、単価マスタを変更しても既存契約の金額は再計算しない。**
- 再計算は明示的な「単価再適用」操作でのみ行い、必ず新しい snapshot 行と監査ログを残す。
- 集計（ダッシュボード・精算・PL）は常に `contracts` のスナップショット列を合計する。
  → §35「単価変更 → 過去契約の粗利が変わらない」を構造的に担保。

## 8.5 キャンセル・不備の扱い（§35）

`contract_statuses` に `is_active_contract` / `is_cancelled` / `is_defect` フラグを持つ。

```
有効売上・有効支払・粗利の集計対象 = is_cancelled = false の契約
キャンセル件数                     = is_cancelled = true
キャンセル率                       = キャンセル件数 ÷ 総契約件数
```

精算ではキャンセルを `settlement_items.cancel_deduction` として控除し、
`final_amount = payout − adjustment − cancel_deduction` とする。

## 8.6 催事損益（§52）

```
販売粗利      = Σ hq_gross_profit（当該催事の契約）
催事経費      = Σ expenses.amount（event_id = 当該催事）+ Σ booth 固定費 + Σ shift 人件費
催事営業利益  = 販売粗利 − 催事経費
```

## 8.7 月次損益（§51）

```
売上高        = Σ revenues.amount（recognized_on が当月）
代理店支払    = Σ revenues.agency_payout
売上総利益    = 売上高 − 代理店支払
販管費        = Σ expenses（カテゴリ別: 催事費/人件費/交通費/宿泊費/販促費/その他）
営業利益相当額 = 売上総利益 − 販管費
営業利益率    = 営業利益相当額 ÷ 売上高
```

## 8.8 金額の取り扱い

- 金額は **整数（円）** で保持（`Decimal(18,2)`）。単価は `Decimal(12,4)`（0.5円/W 等に対応）。
- 丸めは `Math.round`（四捨五入）を `src/lib/money.ts` に一元化。**画面側で丸めない**。
- 率（粗利率等）は 0–1 の `Decimal(9,6)` で保持し、表示時のみ %化。
- すべての計算はサーバー側を正とする（フロントは表示のみ）。
