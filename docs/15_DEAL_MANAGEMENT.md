# 15. 案件管理（太陽光・蓄電池）

現在 Google スプレッドシートで運用している「顧客・案件管理シート」をシステムへ移す。
対象業務は **太陽光(PV) / 蓄電池(BT) / 給湯設備等(EQ) / IH の訪販**で、
既存の電力契約（`contracts`）とは商流・単価の決まり方・進捗管理の粒度が異なる。

| 観点 | 電力契約（既存） | 案件（本章） |
| --- | --- | --- |
| 金額の決まり方 | 単価マスタから解決（§6）。W数や使用量 × 単価 | **案件ごとの販売価格と原価**を個別に入力 |
| 支払 | 代理店へ単価ベースで支払 | **営業・代理店へ歩合（コミッション）** |
| 進捗 | 契約ステータスのみ | **ローン審査・現調・補助金・工事・入金・書類・系統連系** |
| 期間 | 申込 → 開通 | アポ取得 → 商談 → 契約 → 審査 → 現調 → 工事 → 完工 |

そのため既存の `Contract` を拡張せず、**別エンティティ `Deal`（案件）として追加**する。
顧客（`Customer`）は共用し、同一顧客の電力契約と太陽光案件を 1 人の顧客として扱える。

---

## 15.1 ER

```
Customer ──┬─< Deal >─┬── DealStatus        (案件ステータスマスタ)
           │          ├── Agency            (代理店。自社直販は NULL)
           │          ├── Staff (closer)    (CL = クロージング担当)
           │          ├── Staff (appointer) (AP = アポイント担当)
           │          ├── Partner           (信販会社。kinds に FINANCE)
           │          ├── Manufacturer      (PV / 蓄電池 / EQ の各メーカー)
           │          └── EquipmentModel    (蓄電池型式。容量を持つ)
           │
           └─< Contract (電力契約。既存)

Deal ──1:1── DealProgress       (進捗管理)
Deal ──1:1── DealCompensation    (報酬管理)
Deal ──1:N── DealActivity        (対応履歴・ステータス変更履歴)
```

`DealProgress` / `DealCompensation` を `Deal` に埋め込まず 1:1 で分けるのは、

- 進捗は契約後にしか存在しない（40件中 21件のみ）
- 報酬は**代理店に見せてはならない列を含む**ため、テーブルごと権限を分けたい（§17）

という 2 点の理由による。

---

## 15.2 テーブル定義

### deal_statuses（案件ステータスマスタ）

業務側で増減しうるためコードの enum にせずマスタにする（`contract_statuses` と同じ方針）。

| 列 | 型 | 説明 |
| --- | --- | --- |
| code / label | String | `APPOINTMENT` / 「アポ取得」 |
| sortOrder | Int | ファネル表示順 |
| stage | DealStage | 集計用の大分類 |
| isOpen | Boolean | 進行中案件としてカウントするか |
| isContracted | Boolean | 契約済（契約日が入る段階）か |
| isWon | Boolean | 完工＝成約完了 |
| isLost | Boolean | 失注・解約 |
| color | String | バッジ色 |

### deals（案件）

| 列 | 型 | 説明 |
| --- | --- | --- |
| code | String | 案件ID（`A0001`）。組織内で一意 |
| customerId | String | 顧客 |
| agencyId | String? | 代理店。**NULL = 自社直販** |
| statusId | String | 案件ステータス |
| closerStaffId / appointerStaffId | String? | CL / AP |
| productTypes | DealProductType[] | `PV` `BT` `EQ` `IH` の組み合わせ |
| pvManufacturerId / pvCapacityKw | String? / Decimal(8,3)? | 太陽光メーカー・容量(kW) |
| batteryManufacturerId / batteryModelId / batteryCapacityKwh | String? / String? / Decimal(8,3)? | 蓄電池 |
| equipmentManufacturerId | String? | EQ メーカー |
| metAt | Date? | 商談日 |
| contractedAt | Date? | 契約日 |
| salesPriceExclTax | Decimal(18,2)? | 販売価格（税抜） |
| paymentMethod | PaymentMethod? | 現金 / 銀行 / 信販 |
| financeCompanyId | String? | 信販会社（`partners`） |
| lostReason | String? | 失注理由 |
| nextActionAt | Date? | 次回アクション日 |
| priority | DealPriority | 高 / 中 / 低 |
| notes | String? | 備考 |
| deletedAt | DateTime? | 論理削除 |

### deal_progresses（進捗管理）

| 列 | 型 |
| --- | --- |
| loanReview | LoanReviewState |
| siteSurvey / siteSurveyAt | SiteSurveyState / Date? |
| subsidy / subsidyProgram / subsidyAppliedAt / subsidyApprovedAt | SubsidyState / String? / Date? / Date? |
| construction / constructionScheduledAt / constructionCompletedAt | ConstructionState / Date? / Date? |
| completionCheck | ProgressState |
| paymentDueAt / paidAt / paymentStatus | Date? / Date? / DealPaymentStatus |
| contractDocument / importantMatters / warranty / sitePhotos | ProgressState × 4 |
| gridConnection | ProgressState |
| attention | String? |

### deal_compensations（報酬管理）

**入力**は原価内訳・控除額・率・支払情報のみ。販売価格・営業担当・代理店・商材は
`deals` から参照し、二重に持たない（スプレッドシートの自動参照列に相当）。

| 列 | 型 | 区分 |
| --- | --- | --- |
| equipmentCost / constructionCost / extendedWarrantyCost / otherCost | Decimal(18,2) | 入力 |
| deductionAmount | Decimal(18,2) | 入力 |
| salesCommissionRate / agencyCommissionRate | Decimal(9,6) | 入力 |
| totalCost / grossProfit / commissionBase / salesCommission / agencyCommission / companyGrossProfit | Decimal(18,2) | **計算結果のスナップショット** |
| calculatedAt | DateTime | 計算時刻 |
| paymentDueAt / paidAt / paymentStatus | Date? / Date? / CompensationPaymentStatus | 入力 |

計算結果を列として持つのは、率や控除額の運用ルールを後から変えても
**過去に支払った金額が動かないようにする**ため（電力の単価スナップショットと同じ思想、§6）。

---

## 15.3 案件ステータスと遷移

```
                                  ┌→ 商談前キャンセル（失注）
アポ取得 → 商談予定 ──────────────┼→ FO（商談化せず・失注）
                    ↓
                  提案中 ─────────┼→ CLO（提案条件が合わず・失注）
                    ↓             └→ 再商談（オープンへ戻る）
                   契約 ──────────→ クーリングオフ（契約後解約・失注）
                    ↓
          仮審査中 → 仮審査済 → 本審査中 → 本審査済
                    └──────────────────────→ B（ローン審査否決・失注）
                    ↓
              現調待ち → 工事待ち → 残工事 → 完工（成約完了）
```

| code | label | stage | isOpen | isContracted | isWon | isLost |
| --- | --- | --- | --- | --- | --- | --- |
| APPOINTMENT | アポ取得 | APPOINTMENT | ○ | | | |
| MEETING_SCHEDULED | 商談予定 | MEETING | ○ | | | |
| CANCELLED_BEFORE_MEETING | 商談前キャンセル | LOST | | | | ○ |
| PROPOSAL | 提案中 | PROPOSAL | ○ | | | |
| FO | FO | LOST | | | | ○ |
| CLO | CLO | LOST | | | | ○ |
| B | B | LOST | | | | ○ |
| COOLING_OFF | クーリングオフ | LOST | | ○ | | ○ |
| RE_MEETING | 再商談 | PROPOSAL | ○ | | | |
| CONTRACTED | 契約 | CONTRACT | ○ | ○ | | |
| PRE_SCREENING | 仮審査中 | SCREENING | ○ | ○ | | |
| PRE_APPROVED | 仮審査済 | SCREENING | ○ | ○ | | |
| MAIN_SCREENING | 本審査中 | SCREENING | ○ | ○ | | |
| MAIN_APPROVED | 本審査済 | SCREENING | ○ | ○ | | |
| SURVEY_PENDING | 現調待ち | SURVEY | ○ | ○ | | |
| CONSTRUCTION_PENDING | 工事待ち | CONSTRUCTION | ○ | ○ | | |
| CONSTRUCTION_PARTIAL | 残工事 | CONSTRUCTION | ○ | ○ | | |
| COMPLETED | 完工 | COMPLETED | | ○ | ○ | |

`FO` / `CLO` / `B` は略語のためダミーデータの失注理由から意味を確定した。
`ASSUMPTIONS.md` D-1 に記録する（呼称が違う場合はラベルのみ変更すればよい）。

---

## 15.4 報酬計算

スプレッドシートの計算式を逆算し、全 21 件で一致を確認した仕様。
**フロントでは計算せず、サーバー側の 1 箇所（`src/server/services/deals/compensation.ts`）だけで行う**（§34）。

```
原価合計           = 設備費 + 工事代 + 延長保証料 + その他原価
営業利益           = 販売価格(税抜) − 原価合計
コミッション対象額 = max(0, 営業利益 − 控除額)
営業コミッション   = コミッション対象額 × 営業コミッション率
代理店コミッション = コミッション対象額 × 代理店コミッション率
会社残粗利         = 営業利益 − 営業コミッション − 代理店コミッション
```

- **`max(0, …)`** が要点。赤字案件（販売価格 < 原価）ではコミッションが 0 になり、
  会社残粗利は営業利益（＝マイナス）のまま残る。ダミーデータの A0013 がこのケース。
- 端数は**円未満を四捨五入**して保存する（`ASSUMPTIONS.md` D-2）。
- 金額は `Decimal` で扱い、浮動小数点を経由させない。

---

## 15.5 認可

§4（データ分離）と §17（本部粗利の非表示）をそのまま適用する。

| 権限 | 内容 | 付与ロール |
| --- | --- | --- |
| `deal:read` | 案件の閲覧 | 本部全員 / 代理店全員（自代理店のみ） |
| `deal:write` | 案件の登録・編集 | 本部管理者・本部スタッフ |
| `deal:progress` | 進捗の更新 | 本部管理者・本部スタッフ |
| `deal:compensation` | 報酬の閲覧・編集 | **本部管理者のみ** |

- 代理店ロールは閲覧のみ（`deal:read`）。登録・進捗更新は当面本部だけが行う
  （既存の `contract:write` と同じ扱い。代理店向け入力画面を作る段階で権限を付与する）。
- 代理店ロールは `agencyScope()` により自代理店の案件しか取得できない。
  自社直販（`agencyId = NULL`）の案件は代理店から**一切見えない**。
- 代理店は `deal:compensation` を持たないため、報酬は取得経路そのものが無い。
  ただし将来「代理店に自社コミッションだけ見せる」要件が来た場合に備え、
  `maskDealFinancials()` で**原価・営業利益・会社残粗利・控除額・営業コミッション**を
  オブジェクトから物理削除する関数を用意し、代理店コミッションのみ残せる形にする。
- 案件の作成・更新・ステータス変更・報酬の更新はすべて監査ログに残す（§27）。

---

## 15.6 画面

| URL | 権限 | 内容 |
| --- | --- | --- |
| `/deals` | `deal:read` | 一覧。ステータス / 商材 / 代理店 / 営業 / キーワードで絞り込み。次回アクション超過を強調 |
| `/agency/deals` `/agency/deals/[id]` | `deal:read` | 代理店向け。自社案件の閲覧のみ（報酬は表示しない） |
| `/deals/new` | `deal:write` | 案件登録 |
| `/deals/[id]` | `deal:read` | 詳細。概要 → 進捗 → 報酬（権限がある場合のみ）→ 対応履歴 |
| `/deals/[id]/edit` | `deal:write` | 案件編集 |
| `/deals/[id]/progress` | `deal:progress` | 進捗の更新 |
| `/deals/[id]/compensation` | `deal:compensation` | 原価・控除額・率の入力。計算結果を即時表示 |
| `/deals/pipeline` | `deal:read` | ステータス別件数と金額（ファネル） |

サイドバーには「案件」セクションを追加する（`/deals` `/deals/pipeline`）。

---

## 15.7 KPI 定義

スプレッドシートのダッシュボードと同じ値になることを確認済み（括弧内はダミーデータでの値）。

| KPI | 定義 |
| --- | --- |
| 総顧客数 | 案件を持つ顧客の数（40） |
| 進行中案件 | `isOpen = true` の案件数（25） |
| 今月の契約件数 | `contractedAt` が当月の案件数（23） |
| 今月の契約売上 | 上記案件の `salesPriceExclTax` 合計（75,380,000） |
| 営業利益合計 | `DealCompensation.grossProfit` の合計（19,780,000） |
| 次回アクション超過 | `nextActionAt < 今日` かつ `isOpen` の案件数 |
| 入金期限超過 | `paymentDueAt < 今日` かつ `paymentStatus != PAID` の案件数 |
| 工事待ち | ステータス `CONSTRUCTION_PENDING` の案件数（2） |

「今月の契約売上」は**販売価格（税抜）の合計であり、粗利ではない**。
代理店ロールには売上・粗利系の KPI を返さない。

---

## 15.8 既存機能との関係

- **顧客は共用**。太陽光案件の顧客も `/customers` に出る。
- **アップセル CRM（§18–23 / `upsell_leads`）との違い**:
  `upsell_leads` は「電力契約者へ太陽光を提案する架電管理」で、案件化する前の段階。
  商談化して見積が出た時点で `Deal` を作る、という関係にする。
  今回のダミーデータは `Deal` 側のみで、両者の自動連携は実装しない（PHASE 5 の残課題）。
- **催事（`events`）との紐付け**は今回のシートに無いため列を持たせない。
  必要になれば `Contract` と同じく `eventId` / `boothId` を追加する。
- **会計（`revenues` / `payables`）への連携**は本章では行わない。
  報酬の支払は `deal_compensations` の支払状況で管理し、
  会計連携は PHASE 8 の `payables` 設計と合わせて行う。
