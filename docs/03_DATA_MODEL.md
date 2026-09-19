# 03. DB設計 / ER

> 実装は `prisma/schema.prisma` が単一ソース。本書は設計意図を記録する。

## 3.1 全体像（ドメイン別）

```
┌─ テナント ──────────────────────────────────────────────┐
│ organizations ─┬─ users ─── sessions / accounts (Better Auth)│
│                ├─ agencies ─── agency_unit_prices(履歴)      │
│                │        └─ staff ─── staff_compensations     │
│                └─ audit_logs                                  │
└──────────────────────────────────────────────────────────┘
        │
┌─ 販売 ──────────────────────────────────────────────────┐
│ customers ─┬─ contracts ─┬─ contract_pricing_snapshots        │
│            │             ├─ contract_status(master)           │
│            │             └─ revenues ─── receivables           │
│            ├─ customer_activities (タイムライン)               │
│            └─ upsell_leads ─┬─ upsell_activities(架電)         │
│                             └─ tossups ─── partners            │
└──────────────────────────────────────────────────────────┘
        │
┌─ 催事 ──────────────────────────────────────────────────┐
│ facilities ─ events ─┬─ booths ─ event_booth_tags ─ booth_tags │
│                      ├─ event_staff_shifts ─ staff             │
│                      ├─ event_metrics (ファネル実績)           │
│                      └─ expenses (催事費)                      │
└──────────────────────────────────────────────────────────┘
        │
┌─ 会計 ──────────────────────────────────────────────────┐
│ expense_categories ─ expenses ─ accounting_categories          │
│ partners(取引先) ─ invoices ─ invoice_items                    │
│ payables ─ payments      receivables                            │
│ settlements ─ settlement_items   cost_allocations               │
└──────────────────────────────────────────────────────────┘
        │
┌─ 取込 ──────────────────────────────────────────────────┐
│ csv_templates ─ import_batches ─ import_rows                   │
└──────────────────────────────────────────────────────────┘
```

## 3.2 テーブル定義（要点）

### テナント / 認証

| テーブル | 主な列 | 備考 |
| --- | --- | --- |
| `organizations` | id, name, code, status | マルチテナント境界。全 fact テーブルに `organization_id` |
| `users` | id, email, name, role, organization_id, agency_id, is_active, last_login_at | Better Auth の user モデル。`role` は下記5種 |
| `sessions` / `accounts` / `verifications` | Better Auth 標準 | セッションは httpOnly + secure cookie |
| `agencies` | id, org_id, code, name, corporate_name, contact_person, phone, email, postal_code, prefecture, address, contract_start_date, contract_end_date, status, payment_terms, bank_* , notes | §5 |
| `agency_unit_prices` | id, agency_id, product_id, unit_type, unit_price, effective_from, effective_to, note, created_by | **適用期間つき単価履歴**（§5） |
| `staff` | id, org_id, agency_id?, user_id?, code, name, kana, phone, employment_type, status | 販売スタッフ（アプリユーザーとは限らない） |
| `staff_compensations` | id, staff_id, comp_type(HOURLY/DAILY/FIXED/COMMISSION), amount, commission_rate, effective_from, effective_to | §62 有効期間つき。過去催事の利益は変わらない |

### マスタ

| テーブル | 備考 |
| --- | --- |
| `products` | 商材マスタ。`category`(ELECTRICITY/SOLAR/BATTERY/SOLAR_BATTERY/GAS/WATER/INTERNET/EV_CHARGER/REFORM/OTHER) + `unit_type`(WATT/CONTRACT/AMOUNT)。**電力専用に固定しない**（§37/§63） |
| `suppliers` | 上位会社・電力会社 |
| `plans` | 契約プラン（supplier_id 配下） |
| `contract_statuses` | code,label,sort_order,is_active_contract,is_cancelled,is_defect,color。マスタ管理（§13） |
| `upsell_statuses` | code,label,sort_order,funnel_stage,is_won,is_lost。追加編集可（§19） |
| `pricing_rules` | **単価マスタ**。scope=(org, agency?, product?, supplier?, plan?), side=(HQ_RECEIVE / AGENCY_PAYOUT), unit_type, unit_price, effective_from/to, priority |
| `booth_tags` | ブース立地タグ（入口付近/エスカレーター付近…）(§42) |
| `expense_categories` | 階層可（parent_id）。管理画面から追加変更可（§44） |
| `accounting_categories` | 勘定科目・補助科目・部門（§74） |
| `partners` | 取引先。`kinds[]` = TOSSUP(トスアップ先) / VENDOR(経費先) / SUPPLIER(上位会社) / OTHER |

### 販売

| テーブル | 備考 |
| --- | --- |
| `customers` | org_id, agency_id, external_customer_id, name, kana, phone, phone_normalized, email, postal_code, prefecture, city, address, building, birth_date, assigned_user_id, source_event_id, acquired_at, status |
| `contracts` | org_id, agency_id, customer_id, product_id, contract_number, supplier_id?, plan_id?, contract_watt, status_id, applied_at, contracted_at, activated_at, cancelled_at, cancel_reason, event_id?, booth_id?, staff_id?, campaign, notes, **hq_unit_price / agency_unit_price / hq_revenue / agency_payout / hq_gross_profit / gross_margin**(スナップショット) |
| `contract_pricing_snapshots` | 再計算のたびに1行追加（誰が/いつ/どの pricing_rule で/計算前後） |
| `revenues` | 売上明細。contract_id? / tossup_id? / product_id / amount / cost / agency_payout / referral_fee / gross_profit / recognized_on / event_id / booth_id / staff_id / agency_id |
| `receivables` | 入金予定と実績。status=未請求/請求済/入金待ち/一部入金/入金済/遅延/取消 |

### アップセルCRM

| テーブル | 備考 |
| --- | --- |
| `upsell_leads` | customer_id, product_id, status_id, assigned_user_id, next_action_at, source_contract_id, score |
| `upsell_activities` | lead_id, type(CALL/MEMO/STATUS_CHANGE/APPOINTMENT), called_at, connected, reaction, next_call_at, memo, status_id, user_id |
| `tossups` | lead_id, partner_id, tossed_at, meeting_scheduled_at, product_id, expected_revenue, referral_fee, status, result, closed_at, actual_revenue |
| `customer_activities` | 全履歴タイムライン。type(CSV_IMPORT/CONTRACT_CREATED/STATUS_CHANGED/CALL/MEMO/APPOINTMENT/TOSSUP/MEETING/WON/CANCELLED) |

### 催事

| テーブル | 備考 |
| --- | --- |
| `facilities` | §41。来館者数など取得困難な項目は **nullable** |
| `events` | §40。facility_id, agency_id?, manager_user_id, start_date, end_date, open_time, close_time, days, booth_count, status |
| `event_agencies` | 催事に複数代理店が参加するケース用の中間表 |
| `booths` | §42+§43。costs(booth_fee, electricity_fee, fixture_fee, other_equipment_fee, setup_fee, teardown_fee) と位置情報(visibility 1-5 等) |
| `event_booth_tags` | booth_id × booth_tag_id |
| `event_staff_shifts` | §61。staff_id, event_id, booth_id, work_date, start_time, end_time, break_minutes, labor_cost(確定値=スナップショット) |
| `event_metrics` | §53/§54。event_id, booth_id?, metric_date, hour_slot?, passersby, approaches, stops, seated, meetings, applications, contracts_count, activations, cancellations（すべて nullable） |

### 会計 / 精算

| テーブル | 備考 |
| --- | --- |
| `expenses` | §45。event_id/booth_id/agency_id/staff_id/partner_id は nullable。**催事費は `event_id` が入った expenses**（§44 の event_expenses を正規化） |
| `expense_approvals` | 承認履歴（申請→承認待ち→承認→支払待ち→支払済）§46 |
| `invoices` / `invoice_items` | §50 |
| `payables` / `payments` | §49 支払管理 |
| `settlements` / `settlement_items` | §25 代理店精算（対象月・件数・W・支払額・調整・キャンセル控除・最終支払額） |
| `cost_allocations` | §75 配賦（対象経費 → 催事/代理店/部門へ、按分基準 CONTRACT_COUNT/REVENUE/WORK_HOURS） |

### 取込 / 監査

| テーブル | 備考 |
| --- | --- |
| `csv_templates` | name, target_entity, encoding, column_mappings(Json), dedupe_strategy(Json), default_values(Json) |
| `import_batches` | file_name, file_hash, status, total_rows, success/failure/created/updated/duplicate counts, imported_by, rolled_back_at |
| `import_rows` | batch_id, row_number, raw(Json), normalized(Json), status, errors(Json), customer_id, contract_id, matched_by |
| `audit_logs` | actor_user_id, action, entity, entity_id, before(Json), after(Json), ip, user_agent, organization_id, agency_id |

## 3.3 設計原則

1. **すべての fact に `organization_id`、販売系には `agency_id`** を持たせ、
   単一の `where` でテナント/代理店分離を保証する。
2. **スナップショット原則**: 金額・単価・人件費は「発生時点の値」を行に保存する。
   マスタ（`pricing_rules` / `staff_compensations`）の改定は過去実績を変えない（§5/§6/§62）。
3. **fact / dimension を意識**（§76）。fact = contracts / revenues / expenses / event_metrics /
   event_staff_shifts。dimension = date, agency, facility, event, booth, staff, product, customer。
   これにより全分析軸（日付・代理店・施設・催事・ブース・担当者・商材・顧客）で横断集計できる。
4. **商材汎用化**: `contracts.product_id` + `products.unit_type` により、
   電力(W課金)・太陽光(件数/金額課金)・通信・ガス等を同一構造で扱う（§37/§63）。
5. **ソフトデリート**: 顧客・契約・代理店は `deleted_at` を持ち物理削除しない（監査要件）。
6. **索引**: `(organization_id, agency_id, created_at)` / `(contract_number)` unique /
   `(phone_normalized, name)` / `(event_id, booth_id)` / `(recognized_on)` などを付与。

## 3.4 §81 で要求される追跡経路

```
customer → contract → agency → event → booth → staff      … contracts の FK で直結
contract → revenues                                        … revenues.contract_id
event    → expenses                                        … expenses.event_id
contract → upsell_leads (source_contract_id)               … 電力契約起点のアップセル
upsell_leads → tossups → revenues (tossup_id)              … 紹介売上
customer → 全 revenues                                     … 顧客LTV
event → 獲得顧客 → その後の upsell revenues                … 催事最終LTV利益（§65/§66）
```
