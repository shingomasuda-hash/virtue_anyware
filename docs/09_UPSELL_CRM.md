# 09. アップセルCRM ステータスフロー

## 9.1 対象

電力契約を獲得した顧客に対し、**太陽光 / 蓄電池 / 太陽光＋蓄電池** を提案する。
電力契約が登録（CSV取込含む）された時点で、自動的に `upsell_leads` が
`未対応` で生成され、アップセル対象リストに現れる（§18）。

## 9.2 ステータス（`upsell_statuses` マスタ、追加編集可 §19）

| # | code | label | funnel_stage |
| --- | --- | --- | --- |
| 1 | `NEW` | 未対応 | TARGET |
| 2 | `CALL_SCHEDULED` | 架電予定 | TARGET |
| 3 | `CALLING` | 架電中 | CALLED |
| 4 | `NO_ANSWER` | 不通 | CALLED |
| 5 | `CALL_AGAIN` | 再架電 | CALLED |
| 6 | `NOT_INTERESTED` | 興味なし | CONNECTED |
| 7 | `INTERESTED` | 興味あり | INTERESTED |
| 8 | `HEARING_DONE` | ヒアリング済 | INTERESTED |
| 9 | `APPOINTMENT` | アポイント獲得 | APPOINTMENT |
| 10 | `TOSSED_UP` | トスアップ済 | TOSSUP |
| 11 | `NEGOTIATING` | 商談中 | MEETING |
| 12 | `QUOTED` | 見積提出 | MEETING |
| 13 | `WON` | 成約 | WON (is_won) |
| 14 | `LOST` | 失注 | LOST (is_lost) |
| 15 | `EXCLUDED` | 対象外 | EXCLUDED (is_lost) |

```
未対応 → 架電予定 → 架電中 ┬→ 不通 → 再架電 ┐
                          │                 ↓
                          └→ 興味なし   （再架電ループ）
                          └→ 興味あり → ヒアリング済 → アポイント獲得
                               → トスアップ済 → 商談中 → 見積提出 → 成約 / 失注
                          対象外（どの段階からも遷移可）
```

## 9.3 架電管理（§20）

架電画面は 顧客名 / 電話番号 / 住所 / 契約電力 / 契約W / 代理店 / 電気契約日 を
1画面に表示し、右ペインで結果を記録する。

記録項目: 架電日時 / 担当者 / 接続・不通 / 顧客反応 / 次回架電日時 / メモ / ステータス
→ `upsell_activities` に1行追加し、`upsell_leads.status_id` と `next_action_at` を更新、
同時に `customer_activities` にタイムライン行を追加する（§21）。

## 9.4 トスアップ（§22）

アポ獲得後、太陽光会社（`partners`, 複数社を想定）へ送客する。

記録: トスアップ日 / トスアップ先会社 / 担当者 / 商談予定日 / 商材 / 想定売上 /
紹介手数料 / ステータス / 結果 / 成約日。成約時は `revenues`（`tossup_id` 紐づけ）を作成し、
紹介利益が顧客LTVと催事LTVに反映される。

## 9.5 ファネル（§23）

```
電力契約 → アップセル対象 → 架電 → 接続 → 興味あり → アポイント → トスアップ → 商談 → 成約
```
各段階の件数と**直前段階からの転換率**を表示。定義は `docs/KPI_DEFINITIONS.md` を単一ソースとする。
