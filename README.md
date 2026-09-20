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
| [docs/13_PHASE1_AUDIT.md](docs/13_PHASE1_AUDIT.md) | **PHASE 1 総点検レポート**（検出した問題と是正内容） |
| [docs/14_DEPLOYMENT.md](docs/14_DEPLOYMENT.md) | **デプロイ手順（Vercel + Neon）**・実際に起きたエラーと対処 |
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
npm run db:migrate    # マイグレーション作成/適用
npm run db:deploy     # マイグレーション適用のみ（本番向け）
npm run db:bootstrap  # 本番初期化（マスタ + 最初の管理者。デモデータは作らない）
npm run db:seed       # デモデータ投入（開発専用。本番では自動的に中止される）
npm run db:reset      # DB リセット + 再シード
npm run preflight     # 本番投入前チェック（開発用の資格情報が残っていないか）
```

### Vercel へのデプロイ

手順・必要な環境変数・実際に起きたエラーと対処は
**[docs/14_DEPLOYMENT.md](docs/14_DEPLOYMENT.md)** に集約している。要点のみ:

```bash
# 1. マイグレーションを本番 DB へ適用（Vercel のビルドでは実行されない）
DATABASE_URL="<本番URL>" npx prisma migrate deploy

# 2. マスタ + 最初の管理者を作成（デモデータは作らない）
DATABASE_URL="<本番URL>" ADMIN_EMAIL="admin@your-company.co.jp" npm run db:bootstrap

# 3. 本番投入前チェック
npm run preflight
```

Vercel に設定する環境変数: `DATABASE_URL`（**プーラー経由** + `sslmode=require`）/
`BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`。

**デプロイ先で何か起きたら、まず `/api/health` を開く。**
環境変数・DB 接続・マイグレーション・初期データを検査し、何が足りないかを返す
（秘密情報は含まない）。エラー画面もこの結果を自動表示する。

ビルドが Vercel と同条件で通るかはローカルで検証できる:

```bash
git clone <repo> /tmp/verify && cd /tmp/verify && npm ci
env -u DATABASE_URL -u BETTER_AUTH_SECRET npm run build
```

### 本番投入前に必ず実行すること

```bash
npm run preflight
```

以下を機械的に検査し、1 件でも重大な問題があれば非ゼロ終了する。

- `BETTER_AUTH_SECRET` が 32 バイト以上かつ開発既定値でないこと
- `BETTER_AUTH_URL` が https であること（警告）
- `DATABASE_URL` が SSL を要求していること（警告）
- **デモ用アカウント（`@virtue.example.jp` / `@example.jp`）が残っていないこと**
- **既知のデモパスワードで認証できるアカウントが存在しないこと**（ハッシュを実際に検証）
- 有効な SUPER_ADMIN が 1 名以上いること
- 組織・単価マスタ・キャンセル用ステータスが登録されていること

さらに、シード自体が本番環境を検知して停止する。

- `NODE_ENV=production` のとき → 中止
- `DATABASE_URL` に `prod` / `production` が含まれるとき → 中止
- 上書きするには `ALLOW_DEMO_SEED=true` を明示する必要がある
- デモパスワードは開発/テスト環境でのみ既定値。それ以外では**ランダム生成**される

> **本番投入時は全アカウントを再作成する前提**です。デモアカウントを残したままでは
> `npm run preflight` がエラーになり、リリース手順を通過できません。

---

## 4. 収益構造

```
hq_revenue      = f(算定方式, 数量, 本部受取単価)   … VIRTUE売上
agency_payout   = f(算定方式, 数量, 代理店支払単価) … 代理店への支払
hq_gross_profit = hq_revenue - agency_payout      … VIRTUE粗利
gross_margin    = hq_gross_profit / hq_revenue    … 粗利率
```

算定方式は単価マスタで切り替わる。現在 5 方式に対応している。

| 方式 | 計算 | 用途 |
| --- | --- | --- |
| `PER_WATT` | 数量 × 円/W | 従来の W 課金商流 |
| `PER_CONTRACT` | 件数 × 定額 | 通信・ウォーターサーバー等 |
| `PERCENT_OF_AMOUNT` | 販売額 × 率 | 太陽光紹介料 |
| `FIXED` | 定額 | 明細なしの場合の手数料など |
| **`TIERED_BY_USAGE`** | 想定使用量(kWh)の階段表 | **エバーグリーン MPプラン（現行の主商流）** |
| **`MARKUP_ON_PAYOUT`** | 代理店手数料 × (1 + 率) | **代理店fee + 10% = VIRTUE 受取** |

### 現行の主商流（エバーグリーン MPプラン）

```
明細の使用量 → × 季節係数[検針月] → 想定使用量 → 対照表（30段）
  → 代理店手数料 → − 業務管理費 → 代理店支払額
  → 手数料 × 1.10 → VIRTUE受取 → 粗利
```

例: 6月検針 500kWh → 係数 116.4% → 想定 582kWh → 「550以上600未満」→
代理店 **45,900円** → VIRTUE **50,490円** → 粗利 **4,590円**（9.09%）。

**同じ 500kWh でも 8月検針なら 433.5kWh → 32,400円** と大きく変わる。
算定根拠は契約詳細画面で段階表示され、契約行にスナップショット保存される。

条件表の「戻入条件」も追跡する（供給開始遅延 3か月 / 短期解約 6か月 / 資料不正）。
期限内の案件は「リスク保有」として、粗利が未確定であることを明示する。

詳細は [docs/08_REVENUE_MODEL.md](docs/08_REVENUE_MODEL.md) の 8.9–8.13。

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
| 階段表の境界（以上・未満）・上限なし・隙間/重複検出 | `tests/unit/tiered-pricing.test.ts` |
| 季節係数で検針月ごとに手数料が変わる | `tests/unit/tiered-pricing.test.ts` |
| 代理店fee + 10% / 明細なし定額 / 業務管理費の相殺 | `tests/unit/tiered-pricing.test.ts` |
| 戻入 3 条件の期限判定（月跨ぎ・年跨ぎ・うるう年） | `tests/unit/clawback.test.ts` |
| 実条件表を DB へ投入した上での算定（12 件） | `tests/integration/evergreen-pricing.test.ts` |
| Shift-JIS CSV の読み込み・列マッピング推測・値正規化 | `tests/unit/csv.test.ts` |
| 顧客登録・契約登録・代理店紐付け（代理店の入力を信用しない） | `tests/integration/write-paths.test.ts` |
| 監査ログに変更前後が記録される | `tests/integration/write-paths.test.ts` |
| 同じ CSV を 2 回取り込んでも二重登録されない | `tests/integration/csv-import.test.ts` |
| 不正なワット数がエラーになり、正常 9 件と切り分けられる | `tests/integration/csv-import.test.ts` |
| 存在しない代理店が警告 / エラーになる | `tests/integration/csv-import.test.ts` |
| ロールバックが対象データのみ安全に戻す | `tests/integration/csv-import.test.ts` |
| 代理店ユーザーが CSV インポートへアクセスできない | `tests/integration/csv-import.test.ts` |

統合テストは `TEST_DATABASE_URL`（既定 `virtue_test`）に対して実行され、開発 DB を汚さない。

---

## 7. CSV インポート（PHASE 2）

`/import` から 6 ステップで取り込む。**実際の CSV フォーマットが未確定でも動くよう、
特定の列名に固定しない設計**にしている。

```
STEP1 アップロード → STEP2 CSV解析 → STEP3 列マッピング
     → STEP4 プレビュー → STEP5 エラー・重複確認 → STEP6 インポート確定
```

| 機能 | 内容 |
| --- | --- |
| 列マッピング | CSV 列 ↔ DB 項目を自由に紐付け。`氏名`/`契約者名`/`NAME`/`customer_name` → `customer.name`、`KW`/`ワット数`/`契約容量` → `contract.watt` などを自動推測し、手動修正も可能 |
| 値の正規化 | `5kW` → `5000` / `"6,500"` → `6500` / `7200W` → `7200` / 電話番号を数字のみに正規化 |
| 文字コード | UTF-8 / UTF-8(BOM) / Shift-JIS(CP932) を自動判定。手動指定も可能 |
| テンプレート | 列マッピングと取込オプションを保存。「電力会社A CSV」「精算データCSV」などを再利用 |
| プレビュー | 既定 50 行（追加読込可）。新規=緑 / 更新=青 / 重複=黄 / エラー=赤 / 警告 を色分け＋フィルタ |
| バリデーション | 契約番号・氏名・電話番号・代理店・ワット数・契約日・ステータス・単価。数値項目の文字混入も検出 |
| 重複防止 | ①契約番号 ②外部顧客ID ③電話＋氏名 ④その他複合キー。完全一致以外は自動登録せず「重複候補」として保留 |
| **DRY RUN** | DB へ一切書き込まず、新規 / 更新 / 重複 / エラー / 警告の件数を試算 |
| 取込履歴 | バッチ単位に 取込日時・ユーザー・ファイル名・行数・新規/更新/重複/エラー件数と行ごとの結果を保存 |
| ロールバック | バッチ単位で取り消し。**取込後に人が変更したデータ、売上が紐づいた契約は巻き戻さない** |

検証用のサンプル CSV は [`fixtures/csv/`](fixtures/csv/) にある（正常・重複・エラー・別列名・未知代理店・Shift-JIS）。

### 画面

| URL | 内容 |
| --- | --- |
| `/import` | 新規インポート（STEP1 アップロード） |
| `/import/{batchId}` | STEP2 解析結果 + STEP3 列マッピング |
| `/import/{batchId}/preview` | STEP4 プレビュー + STEP5 エラー確認 + STEP6 確定 / DRY RUN |
| `/import/history` | インポート履歴 |
| `/import/history/{batchId}` | 取込結果の詳細・ロールバック |
| `/import/templates` | CSVテンプレート管理 |

代理店ユーザーはこれらの画面にアクセスできない（画面 307 / API 403）。

---

## 8. 現在の実装状況

PHASE 1 完了（総点検・是正済み → [docs/13_PHASE1_AUDIT.md](docs/13_PHASE1_AUDIT.md)）。
PHASE 2（CSV インポート）完了。
PHASE 3/4 の中核（単価解決・収益計算・KPI・ダッシュボード）は先行実装済み。
PHASE 5–11（催事管理画面・経費承認・精算・分析・LTV・会計CSV）は
**スキーマとシードを先に完成させてある**（§85「元データが正しく蓄積されること」を優先）。

進捗の詳細は [docs/10_ROADMAP.md](docs/10_ROADMAP.md)。

---

## 9. セキュリティ

- 認証: Better Auth（scrypt / httpOnly+SameSite cookie / ログイン 5req/min のレート制限）
- 認可: サーバー側で全経路チェック。フロントの出し分けは UX 目的のみ
- CSRF: Server Actions の Origin 検証 + Better Auth の CSRF 対策
- XSS: React の自動エスケープ。`dangerouslySetInnerHTML` を ESLint で禁止
- SQLi: Prisma のパラメータ化クエリのみ。`$queryRawUnsafe` を ESLint で禁止
- PII: 電話番号は一覧で部分マスク（`090-****-5678`）。詳細は権限保持者のみ
- 監査: 顧客/契約/単価/代理店/CSV取込/キャンセルの変更を `audit_logs` に before/after つきで記録
- 秘密情報: `.env` は `.gitignore`。`.env.example` のみコミット

詳細は [docs/12_SECURITY.md](docs/12_SECURITY.md)。
