# VIRTUE Sales OS

株式会社VIRTUE の基幹業務システム。
電力切替販売・代理店管理・催事収益分析・経費/管理会計・太陽光/蓄電池アップセルCRM を
**一人の顧客IDで貫通して追跡できる**ように統合する。

```
催事 → ブース → スタッフ → 声掛け → 契約 → ワット数 → 本部売上
    → 代理店支払 → 粗利 → 催事経費 → 催事営業利益
    → アップセル架電 → アポ → トスアップ → 商談 → 成約 → 紹介売上 → 顧客LTV → 催事最終LTV利益
```

---

## 1. ドキュメント

コードを書く前の設計（要件・ER・権限・画面・CSV・収益ロジック・ロードマップ）は `docs/` にある。

| ドキュメント | 内容 |
| --- | --- |
| [docs/01_REQUIREMENTS.md](docs/01_REQUIREMENTS.md) | 要件整理・事業ドメイン・機能要件・非機能要件 |
| [docs/02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md) | 技術選定（版の根拠つき）・レイヤ構成・認可の実装原則 |
| [docs/03_DATA_MODEL.md](docs/03_DATA_MODEL.md) | ER 設計・テーブル定義・設計原則・追跡経路 |
| [docs/04_RBAC.md](docs/04_RBAC.md) | 5ロール・パーミッション表・データスコープ・フィールド秘匿 |
| [docs/05_DIRECTORY.md](docs/05_DIRECTORY.md) | ディレクトリ構造と実装規約 |
| [docs/06_SCREENS.md](docs/06_SCREENS.md) | レイアウト・メニュー・主要画面 33 枚の一覧 |
| [docs/07_CSV_IMPORT.md](docs/07_CSV_IMPORT.md) | 6ステップ取込フロー・文字コード判定・列マッピング・重複チェック |
| [docs/08_REVENUE_MODEL.md](docs/08_REVENUE_MODEL.md) | 収益計算式・単価解決・スナップショット原則 |
| [docs/09_UPSELL_CRM.md](docs/09_UPSELL_CRM.md) | アップセルのステータス遷移・架電・トスアップ・ファネル |
| [docs/10_ROADMAP.md](docs/10_ROADMAP.md) | PHASE 1–11 の実装ロードマップと進捗 |
| [docs/11_MANAGEMENT_ACCOUNTING.md](docs/11_MANAGEMENT_ACCOUNTING.md) | 利益構造・催事別PL・ブース位置分析・原価配賦・会計連携 |
| [docs/12_SECURITY.md](docs/12_SECURITY.md) | 脅威と対策・PII 取扱い・監査対象 |
| [docs/KPI_DEFINITIONS.md](docs/KPI_DEFINITIONS.md) | **全 KPI の計算式（唯一の定義）** |
| [ASSUMPTIONS.md](ASSUMPTIONS.md) | 仕様が未確定な箇所で置いた仮定 |

---

## 2. 技術構成

| 層 | 採用 | 版 |
| --- | --- | --- |
| Framework | Next.js App Router | 16.3 |
| Language | TypeScript (`strict`, `noUncheckedIndexedAccess`) | 5.9 |
| UI | Tailwind CSS 4 + shadcn/ui 方式のローカル UI キット（Radix + CVA） | 4.3 |
| DB | PostgreSQL（Neon 互換） | 16 |
| ORM | Prisma（driver adapter `@prisma/adapter-pg`） | 7.10 |
| 認証 | **Better Auth** 1.7（安定版） | 1.7.5 |
| バリデーション | Zod | 4.6 |
| グラフ | Recharts | 3.10 |
| CSV | papaparse + encoding-japanese（UTF-8 / Shift-JIS 対応） | - |
| テスト | Vitest | 4.1 |

> **認証ライブラリの選定根拠**: 2026-09 時点で Auth.js v5（`next-auth`）は
> `latest` タグが `5.0.0-beta.x` であり安定版が存在しない。
> 要件「現在の安定版を確認した上で実装すること」に従い、
> App Router 対応かつ安定版のある Better Auth を採用した（詳細 `docs/02_ARCHITECTURE.md`）。

---

## 3. セットアップ

```bash
# 1. 依存関係
npm install

# 2. 環境変数（.env はコミットしない）
cp .env.example .env
#   DATABASE_URL       … PostgreSQL / Neon の接続文字列
#   BETTER_AUTH_SECRET … openssl rand -base64 32 で生成した 32 バイト以上の値
#   BETTER_AUTH_URL    … 公開 URL

# 3. DB 構築 + シード
npm run db:migrate
npm run db:seed

# 4. 起動
npm run dev     # http://localhost:3000
```

### 検証用アカウント（開発専用。本番では使用しないこと）

パスワードは全て `Virtue#2026`。

| メール | ロール |
| --- | --- |
| `superadmin@virtue.example.jp` | SUPER_ADMIN |
| `hq.admin@virtue.example.jp` | VIRTUE本部管理者 |
| `hq.staff@virtue.example.jp` | VIRTUE本部スタッフ |
| `ag-a.admin@example.jp` / `ag-a.staff@example.jp` | 代理店A |
| `ag-b.admin@example.jp` / `ag-b.staff@example.jp` | 代理店B |
| `ag-c.admin@example.jp` / `ag-c.staff@example.jp` | 代理店C |

デモデータ: 代理店3社 / 顧客30名 / 契約30件（開通済・審査中・キャンセル・不備などを混在）/
催事3件・ブース6区画・スタッフシフト・催事経費 / アップセル27件（未対応〜成約まで）。

### スクリプト

```bash
npm run dev         # 開発サーバー
npm run build       # prisma generate + next build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest（単体 + 統合）
npm run db:migrate  # マイグレーション作成/適用
npm run db:seed     # シード投入
npm run db:reset    # DB リセット + 再シード
```

---

## 4. 収益構造

```
hq_revenue      = 契約数量 × 本部受取単価        … VIRTUE売上
agency_payout   = 契約数量 × 代理店支払単価      … 代理店への支払
hq_gross_profit = hq_revenue - agency_payout    … VIRTUE粗利
gross_margin    = hq_gross_profit / hq_revenue  … 粗利率
```

例: 5,000W × 本部150円/W = **750,000円**、× 代理店100円/W = **500,000円** →
粗利 **250,000円**（粗利率 **33.3%**）。

### 3つの設計上の約束

1. **単価はコードに書かない。** 必ず `pricing_rules` / `agency_unit_prices` から解決する。
2. **契約時点の単価をスナップショット保存する。** 単価マスタを後から改定しても、
   過去契約の売上・支払・粗利は 1 円も変わらない。集計は常にこのスナップショット列を合計する。
3. **計算式は差し替え可能。** `PER_WATT` / `PER_CONTRACT` / `PERCENT_OF_AMOUNT` / `FIXED` の
   ストラテジを追加するだけで新しい商流に対応できる（ガス・通信・EV充電器・太陽光紹介料など）。

さらに経営管理として、催事単位で

```
売上 - 代理店支払 = 販売粗利
販売粗利 - (ブース代 + 人件費 + 交通費 + 宿泊費 + 販促費 + その他) = 催事営業利益
催事営業利益 + その催事で獲得した顧客の後日アップセル利益 = 催事最終LTV利益
```

を算出する（`docs/11_MANAGEMENT_ACCOUNTING.md` / `docs/KPI_DEFINITIONS.md`）。

---

## 5. 権限とデータ分離

| ロール | 見える範囲 |
| --- | --- |
| `SUPER_ADMIN` | 全組織 |
| `HQ_ADMIN` / `HQ_STAFF` | 自組織すべて（本部財務を含む） |
| `AGENCY_ADMIN` / `AGENCY_STAFF` | **自代理店のみ**。本部単価・本部売上・粗利は一切見えない |

実装上の担保:

- すべての repository は `AccessContext` を必須引数とし、`agencyScope(ctx)` が生成する
  `where` を AND する。代理店ロールでは常に `agencyId = 自社` が入る。
- 単体取得は `findUnique` ではなく `findFirst({ AND: [scope, { id }] })`。
  他代理店の ID を URL / API へ直接入れても 404 になる。
- 本部財務フィールド（`hqUnitPrice` / `hqRevenue` / `hqGrossProfit` / `grossMargin`）は
  権限が無いユーザーには **service 層でキーごと削除**する。UI で隠すだけにしていない。
- 集計クエリ（ダッシュボード・ランキング）にも同じスコープを適用する。

---

## 6. テスト

```bash
npm test
```

要件 §35 で指定された項目をすべて自動テストしている。

| 検証内容 | テスト |
| --- | --- |
| 代理店Aユーザー → 代理店B顧客/契約/代理店を取得できない | `tests/integration/isolation.test.ts` |
| 代理店ユーザー → VIRTUE粗利・本部単価を取得できない | `tests/integration/isolation.test.ts` / `tests/unit/authz.test.ts` |
| 単価変更 → 過去契約の粗利が変わらない | `tests/integration/isolation.test.ts` |
| 同一CSV再アップロード → 重複登録されない | `tests/unit/dedupe.test.ts` |
| キャンセル契約 → 有効売上・支払集計から除外される | `tests/unit/kpi.test.ts` / `tests/integration/isolation.test.ts` |
| 5,000W / 150円 / 100円 → 750,000 / 500,000 / 250,000 | `tests/unit/pricing.test.ts` |
| Shift-JIS CSV の読み込み・列マッピング推測・値正規化 | `tests/unit/csv.test.ts` |

統合テストは `TEST_DATABASE_URL`（既定 `virtue_test`）に対して実行され、開発 DB を汚さない。

---

## 7. 現在の実装状況

PHASE 1 完了。加えて PHASE 2/3 の中核サービス（CSV 解析・重複判定・単価解決・収益計算）と
PHASE 4 のダッシュボードを先行実装している。
PHASE 5–11（催事管理画面・経費承認・精算・分析・LTV・会計CSV）は
**スキーマとシードを先に完成させてある**（§85「元データが正しく蓄積されること」を優先）。

進捗の詳細は [docs/10_ROADMAP.md](docs/10_ROADMAP.md)。

---

## 8. セキュリティ

- 認証: Better Auth（scrypt / httpOnly+SameSite cookie / ログイン 5req/min のレート制限）
- 認可: サーバー側で全経路チェック。フロントの出し分けは UX 目的のみ
- CSRF: Server Actions の Origin 検証 + Better Auth の CSRF 対策
- XSS: React の自動エスケープ。`dangerouslySetInnerHTML` を ESLint で禁止
- SQLi: Prisma のパラメータ化クエリのみ。`$queryRawUnsafe` を ESLint で禁止
- PII: 電話番号は一覧で部分マスク（`090-****-5678`）。詳細は権限保持者のみ
- 監査: 顧客/契約/単価/代理店/CSV取込/キャンセルの変更を `audit_logs` に before/after つきで記録
- 秘密情報: `.env` は `.gitignore`。`.env.example` のみコミット

詳細は [docs/12_SECURITY.md](docs/12_SECURITY.md)。
