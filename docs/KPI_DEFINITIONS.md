# KPI 定義書

> **本書に書かれた式が唯一の定義**であり、実装は `src/server/services/kpi/definitions.ts` に
> 一元化する。画面ごとに異なる計算をしてはならない（§86）。

## 用語 / 集合

| 記号 | 定義 |
| --- | --- |
| `C` | 集計対象期間・スコープの契約集合（`contracts`、`deleted_at IS NULL`） |
| `C_active` | `C` のうち `contract_statuses.is_cancelled = false` |
| `C_cancelled` | `C` のうち `is_cancelled = true` |
| `C_activated` | `C` のうち `activated_at IS NOT NULL`（開通済） |
| `C_defect` | `C` のうち `is_defect = true`（不備） |
| `E` | 対象催事の経費集合（`expenses.event_id = event`） |
| `R` | 売上明細集合（`revenues`、`recognized_on` が期間内） |

期間の基準日は既定で **契約日 `contracted_at`（無ければ `applied_at`）**。
売上系は **計上日 `recognized_on`**。画面の期間セレクタはこの基準日に適用される。

---

## 1. 販売KPI

| KPI | 式 |
| --- | --- |
| 総契約件数 | `count(C)` |
| 有効契約件数 | `count(C_active)` |
| キャンセル件数 | `count(C_cancelled)` |
| **キャンセル率** | `count(C_cancelled) / count(C)`（分母0なら0） |
| 不備件数 | `count(C_defect)` |
| 開通件数 | `count(C_activated)` |
| **開通率** | `count(C_activated) / count(C_active)` |
| **契約率（催事）** | `申込数 / 商談数`（`event_metrics`） |
| 総ワット数 | `Σ C_active.contract_watt` |
| 平均契約W | `Σ C_active.contract_watt / count(C_active)` |
| 契約単価 | `Σ C_active.hq_revenue / count(C_active)` |

## 2. 収益KPI

| KPI | 式 |
| --- | --- |
| **VIRTUE売上 (hq_revenue)** | `Σ C_active.hq_revenue` |
| **代理店支払 (agency_payout)** | `Σ C_active.agency_payout` |
| **粗利 (hq_gross_profit)** | `Σ C_active.hq_gross_profit` = 売上 − 代理店支払 |
| **粗利率 (gross_margin)** | `粗利 / 売上`（売上0なら0） |
| 紹介料 | `Σ R.referral_fee`（トスアップ由来） |
| 売上総利益 | `Σ R.amount − Σ R.agency_payout` |
| **営業利益相当額** | `売上総利益 − Σ expenses.amount`（承認済かつ期間内） |
| 営業利益率 | `営業利益相当額 / 売上高` |
| 前月比 | `(当月値 − 前月値) / 前月値`（前月0なら null 表示 `—`） |

## 3. 催事KPI（§53）

| KPI | 式 |
| --- | --- |
| 開催日数 | `event.days`（無ければ `end_date − start_date + 1`） |
| 営業時間 | `Σ event_staff_shifts.(end−start−break)` の実稼働、または `(close_time−open_time)×日数` |
| 稼働スタッフ数 | `count(distinct event_staff_shifts.staff_id)` |
| 声掛け→着座率 | `seated / approaches` |
| 着座→商談率 | `meetings / seated` |
| 商談→申込率 | `applications / meetings` |
| 申込→開通率 | `activations / applications` |
| **催事売上** | `Σ C_active(event).hq_revenue` |
| **催事粗利** | `Σ C_active(event).hq_gross_profit` |
| **催事経費** | `Σ E.amount` + `Σ booth 固定費` + `Σ shift 人件費` |
| **催事営業利益** | `催事粗利 − 催事経費` |
| **CPA（1契約あたり獲得コスト）** | `催事経費 / count(C_active(event))` |
| **CPA(開通)** | `催事経費 / count(C_activated(event))` |
| 1スタッフあたり契約数 | `count(C_active) / 稼働スタッフ数` |
| 1時間あたり契約数 | `count(C_active) / 総営業時間` |
| 1日あたり契約数 | `count(C_active) / 開催日数` |
| 1㎡あたり利益 | `催事営業利益 / Σ booth.area_sqm` |
| 1時間あたり利益 | `催事営業利益 / 総営業時間` |
| 1スタッフあたり利益 | `催事営業利益 / 稼働スタッフ数` |
| **ブース代ROI** | `催事営業利益 / Σ booth 固定費` |
| **催事ROI** | `催事営業利益 / 催事経費` |

> **ROI の定義を1つに固定する**: `ROI = 利益 ÷ 投下コスト`。
> 「ブース代ROI」は分母がブース関連費のみ、「催事ROI」は分母が催事総経費。

## 4. アップセルKPI

| KPI | 式 |
| --- | --- |
| アップセル対象顧客数 | `count(upsell_leads)`（`EXCLUDED` を除く） |
| 架電数 | `count(upsell_activities WHERE type='CALL')` |
| 接続数 | `count(upsell_activities WHERE type='CALL' AND connected=true)` |
| 接続率 | `接続数 / 架電数` |
| 興味あり数 | `count(leads WHERE funnel_stage >= INTERESTED)` |
| アポイント数 | `count(leads WHERE funnel_stage >= APPOINTMENT)` |
| トスアップ数 | `count(tossups)` |
| 商談数 | `count(tossups WHERE status >= MEETING)` |
| 成約数 | `count(tossups WHERE result='WON')` |
| **アップセル率** | `成約数 / アップセル対象顧客数` |
| ファネル転換率 | 各段階件数 ÷ **直前段階の件数** |

## 5. LTV（§64–§66）

```
顧客LTV = Σ (その顧客に紐づく全 revenues の gross_profit)
        = 電力契約粗利 + 太陽光紹介利益 + 蓄電池紹介利益 + …

催事時点利益      = 催事粗利 − 催事経費                       （= 催事営業利益）
催事アップセル利益 = Σ 顧客LTV_アップセル分（source_event_id = 当該催事の顧客）
催事最終LTV利益   = 催事時点利益 + 催事アップセル利益
```

例: 催事時点利益 200,000 + 太陽光成約 300,000 + 蓄電池成約 150,000 = **最終催事価値 650,000**

## 6. スタッフKPI（§60）

| KPI | 式 |
| --- | --- |
| 稼働日数 | `count(distinct event_staff_shifts.work_date)` |
| 稼働時間 | `Σ (end − start − break)` |
| 成約率 | `count(C_active(staff)) / 商談数(staff)` |
| 1時間あたり契約数 | `count(C_active(staff)) / 稼働時間` |
| 1日あたり契約数 | `count(C_active(staff)) / 稼働日数` |
| 平均契約W | `Σ contract_watt / count(C_active(staff))` |
| キャンセル率 | `count(C_cancelled(staff)) / count(C(staff))` |

## 7. 資金繰り（§72）

```
入金予定 = Σ receivables.amount（due_on が対象日）
支払予定 = Σ payables.amount   （due_on が対象日）
ネット   = 入金予定 − 支払予定
残高予測(d) = 期首残高 + Σ_{t<=d} ネット(t)     … 30 / 60 / 90 日
```

## 8. 分母が 0 のときの規約

- 率系はすべて **0 を返す**（`NaN` / `Infinity` を返さない）。
- ただし「前月比」など「比較不能」を明示すべきものは `null` を返し、UI で `—` を表示する。
- 実装は `safeDivide(numerator, denominator, fallback = 0)` を必ず経由する。
