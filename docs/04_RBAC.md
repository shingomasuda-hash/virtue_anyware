# 04. ユーザー権限設計

## 4.1 ロール

| ロール | コード | スコープ | 概要 |
| --- | --- | --- | --- |
| システム管理者 | `SUPER_ADMIN` | 全組織 | 全企業/全代理店閲覧、ユーザー管理、設定・単価、CSV管理、監査ログ |
| VIRTUE本部管理者 | `HQ_ADMIN` | 自組織全体 | 全顧客/契約/代理店、代理店作成、CSV取込、売上・粗利・支払額、担当者変更、CSV出力 |
| VIRTUE本部スタッフ | `HQ_STAFF` | 自組織全体（許可範囲） | 顧客閲覧/編集、架電、案件管理、トスアップ管理。財務は集計のみ・単価編集不可 |
| 代理店管理者 | `AGENCY_ADMIN` | 自代理店のみ | 自社顧客/契約/件数/W/売上(=自社受取)/支払予定額/自社スタッフ |
| 代理店スタッフ | `AGENCY_STAFF` | 自代理店のみ（許可範囲） | 自社顧客・契約の閲覧、担当分の更新 |

## 4.2 パーミッション定義（`src/server/authz/permissions.ts`）

| permission | SUPER | HQ_ADMIN | HQ_STAFF | AG_ADMIN | AG_STAFF |
| --- | :-: | :-: | :-: | :-: | :-: |
| `org:manage` | ✔ | | | | |
| `user:manage` | ✔ | ✔ | | | |
| `agency:read` | ✔ | ✔ | ✔ | 自社 | 自社 |
| `agency:write` | ✔ | ✔ | | | |
| `customer:read` | ✔ | ✔ | ✔ | 自社 | 自社 |
| `customer:write` | ✔ | ✔ | ✔ | 自社 | 自社(担当) |
| `contract:read` | ✔ | ✔ | ✔ | 自社 | 自社 |
| `contract:write` | ✔ | ✔ | ✔ | | |
| `pricing:read` | ✔ | ✔ | ✔ | 自社支払単価のみ | |
| `pricing:write` | ✔ | ✔ | | | |
| `import:run` | ✔ | ✔ | | | |
| `import:manage` | ✔ | ✔ | | | |
| `finance:hq` （本部売上・粗利・本部単価） | ✔ | ✔ | ✔(閲覧のみ) | **✖** | **✖** |
| `finance:agencyPayout` | ✔ | ✔ | ✔ | 自社 | |
| `settlement:read` / `settlement:write` | ✔ | ✔ | 読のみ | 自社読 | |
| `expense:write` / `expense:approve` | ✔ | ✔ / ✔ | ✔ / ✖ | 自社 / ✖ | |
| `event:read` / `event:write` | ✔ | ✔ | ✔ | 自社読 | 自社読 |
| `upsell:read` / `upsell:write` | ✔ | ✔ | ✔ | ✖ | ✖ |
| `deal:read` （案件 / 太陽光・蓄電池） | ✔ | ✔ | ✔ | 自社 | 自社 |
| `deal:write` | ✔ | ✔ | ✔ | ✖ | ✖ |
| `deal:progress` （進捗更新） | ✔ | ✔ | ✔ | ✖ | ✖ |
| `deal:compensation` （原価・営業利益・会社残粗利） | ✔ | ✔ | **✖** | **✖** | **✖** |
| `report:read` | ✔ | ✔ | ✔ | 自社ダッシュボードのみ | |
| `audit:read` | ✔ | ✔ | | | |
| `export:csv` | ✔ | ✔ | | 自社のみ（顧客/契約） | |

> アップセルCRM（太陽光/蓄電池の架電管理）は VIRTUE 本部の商流であるため、既定では代理店に非公開。
>
> 案件（`deals`）は代理店も**自社分の閲覧**はできるが、登録・進捗更新は当面本部のみ
> （`contract:write` と同じ扱い。代理店向け入力画面を用意する段階で付与する）。
> **報酬（`deal:compensation`）は本部管理者のみ**。
> 原価・営業利益・控除額・会社残粗利・営業個人のコミッションは代理店へ返さない（§17）。
> 自社直販案件（`deals.agency_id IS NULL`）は代理店から一切見えない。
> 詳細は `docs/15_DEAL_MANAGEMENT.md` 15.5。

## 4.3 データスコープ（サーバー強制）

```ts
// src/server/authz/scope.ts
agencyScope(ctx)
//  SUPER_ADMIN            → {}                                  （全組織）
//  HQ_ADMIN / HQ_STAFF    → { organizationId: ctx.organizationId }
//  AGENCY_*               → { organizationId: ctx.organizationId, agencyId: ctx.agencyId }
```

- 一覧・詳細・更新・削除・集計のすべてでこの `where` を必ず AND する。
- 単体取得は `findUnique` ではなく **`findFirst({ where: { id, ...scope } })`**。
  → 他代理店の ID を URL / API に直接入れても 404 になる。
- 作成時は `agencyId` をクライアント入力から採らず、代理店ロールでは `ctx.agencyId` を強制。
- 集計クエリ（`groupBy` / `aggregate`）にも同じ `where` を適用する。

## 4.4 フィールドレベルの秘匿（§17）

`canViewHqFinancials(ctx)` = `role ∈ {SUPER_ADMIN, HQ_ADMIN, HQ_STAFF}`

false のとき、service 層で以下を **レスポンスから削除**する（UI で隠すだけにしない）。

- `hqUnitPrice`, `hqRevenue`, `hqGrossProfit`, `grossMargin`
- `pricingRules`（side = `HQ_RECEIVE`）
- 代理店ランキング内の他代理店行（自社行のみ返す）
- 催事PLの本部側原価・全社損益

代理店が見てよい金額は `agencyUnitPrice` / `agencyPayout`（= 自社の受取見込）のみ。

## 4.5 認可の適用点

| 経路 | 適用方法 |
| --- | --- |
| Server Component (page) | `requireSession()` → `requirePermission(ctx, 'xxx:read')` |
| Server Action | 先頭で `getAccessContext()` → Zod 検証 → `requirePermission` |
| Route Handler (`/api/*`) | 同上。加えて rate limit |
| Repository | 引数に `AccessContext` を必須にし、scope を型レベルで強制 |
| middleware | 未認証を `/login` へ。ロール別トップへの振り分け（UX 目的のみ） |

## 4.6 テスト（§35）

- 代理店Aユーザー → 代理店B顧客を `findById` で取得 → `null`
- 代理店Aユーザー → 代理店B契約一覧 → 0件
- 代理店ユーザー → 契約DTO に `hqRevenue` / `hqGrossProfit` キーが**存在しない**
- 代理店ユーザー → `pricing:write` が拒否される
