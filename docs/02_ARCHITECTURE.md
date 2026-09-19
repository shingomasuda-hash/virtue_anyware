# 02. システム構成

## 2.1 技術スタック（2026-09 時点の安定版を確認して選定）

| 層 | 採用 | 版 | 選定理由 |
| --- | --- | --- | --- |
| Framework | Next.js App Router | 16.x (latest stable) | Server Components / Server Actions で認可をサーバーへ寄せられる |
| Language | TypeScript | 5.x (`strict`) | `any` 禁止方針 |
| UI | Tailwind CSS | 4.x | ユーティリティのみ。デザイントークンは `globals.css` の `@theme` |
| UI Kit | shadcn/ui 方式のローカル実装 (Radix UI + CVA + tailwind-merge) | - | CLI 依存を持たずリポジトリ内で完結。`src/components/ui` |
| DB | PostgreSQL (Neon 互換) | 16 | Neon Serverless Driver へ差し替え可能な素の Postgres |
| ORM | Prisma | 7.x (stable) | 型安全・migration 管理・`prisma/schema.prisma` 単一ソース |
| 認証 | **Better Auth** | 1.7.x (stable) | Auth.js v5 は 2026-09 時点で **beta のみ**（`next-auth@latest` = `5.0.0-beta.x`）。要件「現在の安定版を確認した上で実装」に従い、App Router 対応かつ安定版がある Better Auth を採用。Prisma アダプタ・secure cookie・session 管理・rate limit を標準装備 |
| パスワード | scrypt (Better Auth 既定) | - | Node 標準 crypto。ネイティブビルド不要 |
| バリデーション | Zod | 4.x | Server Action 入力・CSV 行・環境変数 |
| グラフ | Recharts | 3.x | - |
| CSV | `papaparse` + `iconv-lite` + `encoding-japanese` | - | UTF-8 / Shift-JIS(CP932) 双方を判定して読み込み |
| テスト | Vitest | 4.x | 計算ロジック・CSV・権限分離の単体/統合テスト |
| Hosting | Vercel | - | Neon + Vercel を想定。`DATABASE_URL` のみで動作 |

> 認証ライブラリの決定根拠は `docs/ASSUMPTIONS` ではなくここに記録する。
> `npm view next-auth dist-tags` → `latest: 5.0.0-beta.32`（安定版なし）。
> `npm view better-auth dist-tags` → `latest: 1.7.5`（安定版あり）。

## 2.2 レイヤ構成

```
app/                     ルーティング + ページ（薄く保つ。巨大 page.tsx を作らない）
 └ (routes)/…/page.tsx   → feature の Container コンポーネントを呼ぶだけ
src/features/<feature>/  機能単位
   ├ components/         画面部品（Client / Server）
   ├ actions.ts          Server Actions（Zod 検証 → 認可 → service 呼び出し）
   └ schema.ts           Zod スキーマ
src/server/
   ├ auth/               Better Auth 設定・セッション取得・ロール定義
   ├ authz/              認可（AccessContext / scope / guard / field masking）
   ├ services/           ビジネスロジック（金額計算・KPI・CSV・集計）※唯一の計算元
   ├ repositories/       Prisma アクセス。必ず AccessContext のスコープを適用
   └ db.ts               PrismaClient シングルトン
src/lib/                 汎用ユーティリティ（日付・数値・CSV・型）
src/components/ui/       デザインシステム（Button/Table/Card/Badge…）
prisma/                  schema.prisma / migrations / seed.ts
docs/                    設計ドキュメント
tests/                   Vitest（unit / integration）
```

### 依存方向（一方通行）

```
app → features → server/services → server/repositories → prisma
                         ↑
                  server/authz（全経路で必須）
```

- **UI から直接 Prisma を触らない。**
- **金額・KPI 計算をフロントで行わない。** 計算は `server/services/pricing` `server/services/kpi` のみ。
- **認可判定をフロントで行わない。** 画面の出し分けは UX のためであり、真の防御は repository 層。

## 2.3 認可の実装原則（§4 データ分離）

1. すべての DB アクセスは `AccessContext`（`userId` / `role` / `organizationId` / `agencyId`）を要求する。
2. `src/server/authz/scope.ts` の `agencyScope(ctx)` / `orgScope(ctx)` が Prisma の `where` を生成する。
   代理店ロールでは常に `agencyId = ctx.agencyId` が AND される。
3. 単一レコード取得も `findFirst({ where: { id, ...scope } })` を使い、
   ID 直打ち・API 直アクセスで他代理店データを取得できないようにする。
4. 本部専用フィールド（`hqUnitPrice` / `hqRevenue` / `hqGrossProfit` / `grossMargin`）は
   `canViewHqFinancials(ctx)` が false の場合 **service 層で除去**してから返す（画面で隠さない）。
5. Server Action / Route Handler の入口で `requireRole` / `requirePermission` を必ず通す。

## 2.4 環境変数

| 変数 | 用途 | 必須 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 接続文字列（Neon 可） | ✔ |
| `BETTER_AUTH_SECRET` | セッション署名鍵（32byte 以上） | ✔ |
| `BETTER_AUTH_URL` | 公開 URL | ✔ |
| `NODE_ENV` | - | - |

`src/env.ts` で Zod により起動時検証する。`.env` はコミットしない（`.env.example` のみ）。
