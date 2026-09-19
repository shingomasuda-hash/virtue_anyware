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


---

# 実商流: エバーグリーン MPプラン（2026年9月度 条件表）

実際の条件表を受領したため、初期の「円/W」モデルに加えて**階段表方式**を実装した。
これが現時点の主商流であり、`円/W` は他商材・他供給元のために残している。

## 8.9 計算の流れ

```
① 電気料金明細の使用量(kWh)
      ↓  × 季節係数[検針月]
② 想定使用量(kWh)
      ↓  成約事務手数料対照表（階段表・30段）を引く
③ 代理店への成約事務手数料
      ↓  − 業務管理費（マッチング確認案件のみ 1,000円/地点）
④ 代理店支払額
      ↓  ③ × (1 + 上乗せ率 10%)
⑤ VIRTUE 受取額
      ↓  ⑤ − ④
⑥ VIRTUE 粗利
```

### 計算例（実装済みテストと一致）

| 明細使用量 | 検針月 | 係数 | 想定使用量 | 該当区分 | 代理店支払 | VIRTUE受取 | 粗利 | 粗利率 |
| ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 500 kWh | 6月 | 116.4% | 582.0 | 550以上600未満 | 45,900 | 50,490 | 4,590 | 9.09% |
| 500 kWh | 8月 | 86.7% | 433.5 | 400以上450未満 | 32,400 | 35,640 | 3,240 | 9.09% |
| 1,200 kWh | 6月 | 116.4% | 1,396.8 | 1350以上1400未満 | 116,900※ | 129,690 | 12,790 | 9.86% |
| 300 kWh | 1月 | 明細なし | — | 定額 | 3,600 | 3,960 | 360 | 9.09% |
| 40 kWh | 1月 | 86.9% | 34.76 | 50未満 | 0 | 0 | 0 | 0% |

※ マッチング確認案件のため業務管理費 1,000円 を相殺（117,900 − 1,000）。
   上乗せ率は**控除前**の手数料に掛かるため、控除分はそのまま VIRTUE の粗利になる。

**同じ 500kWh でも検針月が違うと手数料が 13,500 円変わる**点が重要で、
検針月の取り違えがそのまま金額の誤りになる。CSV 取込では検針月が空のとき
契約日の月で補完し、その旨を警告として表示する。

## 8.10 季節係数の解釈（要確認事項）

条件表には係数の適用方法（乗算か除算か）が明記されていない。

使用量が多い月（1月 86.9% / 8月 86.7%）の係数が 100% 未満、
少ない月（5月 114.2% / 6月 116.4%）が 100% 超であることから、
**「実績を平準化する乗算」** と解釈して実装している。

```
想定使用量 = 明細の使用量 × 季節係数[検針月]
```

除算が正しい場合は `src/server/services/pricing/usage.ts` の
`SEASONAL_COEFFICIENT_MODE` を `'divide'` に変えるだけで切り替わる
（呼び出し側の変更は不要）。→ `ASSUMPTIONS.md` C-9

## 8.11 単価の優先順位（重要）

代理店支払単価は 2 か所に登録できるため、**より具体的な方**を採用する。

| 登録先 | 指定できるスコープ | specificity |
| --- | --- | --- |
| `agency_unit_prices`（代理店マスタ） | 代理店 + 商材 | 最大 2 |
| `pricing_rules(AGENCY_PAYOUT)` | 代理店 + 商材 + 供給元 + プラン | 最大 4 |

「代理店マスタを常に優先」にすると、汎用の 円/W 単価が供給元固有の階段表を
握りつぶし、**手数料が 0 円になる事故**が起きる（実機検証で検出・修正済み）。

## 8.12 戻入（クローバック）

条件表の「戻入条件」を契約単位で追跡する。期限内の案件は `AT_RISK` として扱い、
粗利が未確定であることを画面に明示する。

| 事由 | 判定 | 返還期限 |
| --- | --- | --- |
| ① 供給開始に至らなかった | 申込月を 1 か月目として **3 か月目末日**までに供給開始が無ければ確定 | 4 か月目末日 |
| ② 短期解約・プラン変更 | 供給開始月を 1 か月目として **6 か月目末日**までの終了で確定 | 供給終了月の手数料と相殺 |
| ③ 提出資料の不正・虚偽 | 期限なし。発覚時に確定（別途損害賠償の対象） | — |

実装は `src/server/services/pricing/clawback.ts`。
月跨ぎ・年跨ぎ・うるう年を含めてテスト済み。

## 8.13 条件表の改定

条件表は毎月通知され、「2 回以上通知された場合は改定日の新しい通知書が優先」される。
これは既存の**適用期間つき単価マスタ**でそのまま表現できる。

- 改定時は新しい `effectiveFrom` の行を追加する（既存行は前日で締める）
- 過去契約の金額は契約行のスナップショットで保護されるため、遡って変わらない
