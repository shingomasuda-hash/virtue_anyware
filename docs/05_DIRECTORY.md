# 05. ディレクトリ構造

```
virtue_anyware/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│       ├── index.ts            エントリ
│       ├── masters.ts          組織/ステータス/商材/タグ/勘定科目
│       └── demo.ts             代理店3社・顧客30名・契約・催事・アップセル
├── src/
│   ├── app/
│   │   ├── layout.tsx, globals.css
│   │   ├── (auth)/login/page.tsx
│   │   ├── (hq)/                       本部レイアウト（サイドバー+ヘッダー）
│   │   │   ├── dashboard/  customers/  contracts/  agencies/
│   │   │   ├── upsell/     tossups/    revenue/    settlements/
│   │   │   ├── import/     reports/    users/      settings/
│   │   │   ├── events/     facilities/ expenses/
│   │   └── (agency)/                   代理店レイアウト
│   │       ├── dashboard/ customers/ contracts/ settlements/ staff/
│   │   └── api/auth/[...all]/route.ts  Better Auth ハンドラ
│   ├── components/
│   │   ├── ui/            Button, Input, Table, Card, Badge, Select, Dialog, Tabs …
│   │   ├── layout/        AppShell, Sidebar, Header, Breadcrumb
│   │   └── data/          DataTable, StatCard, EmptyState, Pagination, FilterBar
│   ├── features/
│   │   ├── auth/  agencies/  customers/  contracts/  pricing/
│   │   ├── import/  dashboard/  upsell/  tossup/  settlement/
│   │   ├── events/  expenses/  analytics/
│   │   └── 各: components/ actions.ts schema.ts
│   ├── server/
│   │   ├── db.ts
│   │   ├── auth/        auth.ts, session.ts
│   │   ├── authz/       context.ts, permissions.ts, scope.ts, guard.ts, mask.ts
│   │   ├── services/    pricing.ts, contracts.ts, customers.ts, agencies.ts,
│   │   │                csv-import.ts, dedupe.ts, kpi.ts, settlement.ts,
│   │   │                event-pl.ts, ltv.ts, audit.ts
│   │   └── repositories/ customer.repo.ts, contract.repo.ts, agency.repo.ts …
│   ├── lib/             money.ts, date.ts, csv.ts, encoding.ts, format.ts, result.ts
│   └── env.ts
├── tests/
│   ├── unit/            pricing.test.ts, kpi.test.ts, dedupe.test.ts, csv-parse.test.ts
│   └── integration/     authz-isolation.test.ts, csv-import.test.ts, settlement.test.ts
└── docs/
```

## 規約

- `page.tsx` は 80 行以内を目安。データ取得 → feature コンポーネントへ委譲。
- 同一ロジックを複数箇所に書かない。計算は `server/services` のみ。
- `any` 禁止（ESLint `@typescript-eslint/no-explicit-any: error`）。
- Server Action は必ず `'use server'` + Zod 検証 + 認可ガード。
- DTO は `features/*/types.ts` ではなく service の戻り値型を再利用する。
