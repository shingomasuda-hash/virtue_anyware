# 14. デプロイ手順（Vercel + Neon）

## 14.1 必要な環境変数

Vercel の **Project Settings → Environment Variables** に設定する。

| 変数 | 必須 | 対象環境 | 説明 |
| --- | :-: | --- | --- |
| `DATABASE_URL` | ✔ | Production / Preview / **Development(ビルド時)** | PostgreSQL 接続文字列。**必ずプーラー経由**（Neon なら `-pooler` 付き）+ `sslmode=require` |
| `BETTER_AUTH_SECRET` | ✔ | Production / Preview | セッション署名鍵。`openssl rand -base64 32` で生成 |
| `BETTER_AUTH_URL` | 推奨 | Production | 公開 URL（例 `https://virtue.example.com`）。未設定時は `VERCEL_URL` から自動解決する |
| `DATABASE_POOL_MAX` | | | 1 インスタンスあたりの最大接続数。既定は Vercel 上で 1 |

> `DATABASE_URL` は**ビルド時にも参照される**（`prisma generate` は不要だが、
> 設定しておくと安全）。Vercel の環境変数は既定で全環境に適用されるため、
> 特定環境だけに絞っている場合は Preview にも付与すること。

### Neon の接続文字列

```
postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/virtue?sslmode=require
                                    ^^^^^^^ プーラー必須
```

サーバーレスは実行ごとに接続を張るため、**プーラーを通さないと接続上限で落ちる**。

## 14.2 デプロイ手順

### 事前準備（初回のみ / ターミナル）

```bash
# Node.js 20.11 以上が必要
node -v

# リポジトリを取得（main ではなく作業ブランチを指定する）
git clone -b claude/compassionate-lovelace-tzr2g9 \
  https://github.com/shingomasuda-hash/virtue_anyware.git
cd virtue_anyware

# 依存関係の導入（postinstall で Prisma Client も生成される）
npm ci
```

> `src/generated/prisma` は Git 管理外のため、`npm ci` を省くと
> `db:deploy` / `db:bootstrap` がモジュール未検出で失敗する。


```bash
# 1. マイグレーションを本番 DB へ適用する（Vercel のビルドでは実行されない）
DATABASE_URL="<本番のURL>" npx prisma migrate deploy

# 2. マスタと最初の管理者を作成する（デモデータは作らない）
DATABASE_URL="<本番のURL>" \
ADMIN_EMAIL="admin@your-company.co.jp" \
ADMIN_NAME="管理者名" \
npm run db:bootstrap
#   → 初期パスワードが表示される。控えて初回ログイン後に変更すること。
#   → ADMIN_PASSWORD を指定すれば自分で決められる（12文字以上・3種類以上）

# 3. 本番投入前チェック
DATABASE_URL="<本番のURL>" BETTER_AUTH_SECRET="<本番の値>" BETTER_AUTH_URL="<公開URL>" \
  npm run preflight

# 4. Vercel へデプロイ（git push で自動、または vercel --prod）
```

### マイグレーションをビルドに含めない理由

`prisma migrate deploy` をビルドスクリプトに入れると、**プレビューデプロイのたびに
本番 DB のスキーマが変わる**。意図しないタイミングでの適用を避けるため、
手動またはデプロイパイプラインの独立したステップで実行する運用にしている。

## 14.3 デプロイで実際に起きたエラーと対処

初回デプロイで発生した問題と、リポジトリ側で行った恒久対処。

### ① `npm ci` が lockfile 不一致で失敗する

```
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json are in sync.
npm error Invalid: lock file's picomatch@2.3.2 does not satisfy picomatch@4.0.7
```

**原因**: 開発時に `npm install --legacy-peer-deps` を使ったため lockfile が不整合になっていた。
Vercel は `npm ci` を使うので、ローカルの `npm install` では気づけない。

**対処**: lockfile を作り直してコミット済み。以後は `--legacy-peer-deps` を使わない。

### ② `prisma generate` が DATABASE_URL 不足で失敗する

```
PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL
```

**原因**: `prisma.config.ts` が `env('DATABASE_URL')` を使っており、
未設定だと**設定ファイルの読み込み自体**が失敗していた。`generate` は DB 接続を必要としない。

**対処**: URL が無い場合は `datasource` を省略するようにした（`prisma.config.ts`）。

### ③ ビルド中に `DATABASE_URL が設定されていません` で失敗する

```
Error: Failed to collect page data for /
  [cause]: Error: DATABASE_URL が設定されていません。
```

**原因**: `src/server/db.ts` がモジュール読み込み時に `new PrismaClient()` していた。
Next.js のビルドは page data 収集のためモジュールを読み込むだけで実行するため、
ビルド時に接続情報を要求してしまっていた。

**対処**: Proxy による**遅延生成**に変更。初回アクセスまでクライアントを作らない。

### ④ ビルドは成功するのに実行時に Prisma が初期化できない

**原因**: Prisma 7 はクエリコンパイラを WASM（`query_compiler_fast_bg.wasm`, 3.4MB）で持つ。
Prisma Client の生成先を `src/generated/prisma` にしているため、
Next.js のファイルトレースがこの WASM を検出できず、
serverless バンドルに含まれていなかった。**ビルドログには一切出ない**ため気づきにくい。

**対処**: `next.config.ts` に `outputFileTracingIncludes` を追加。

```ts
outputFileTracingIncludes: {
  '/**': ['./src/generated/prisma/**/*'],
},
```

検証方法:

```bash
npm run build
find .next -name "*.nft.json" -exec grep -l "query_compiler_fast_bg.wasm" {} \; | head -1
# → 何か出力されれば OK
```

### ⑤ `middleware` が非推奨

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

**対処**: `src/middleware.ts` → `src/proxy.ts` に改名し、`export function proxy` へ変更済み。

### ⑥ ログイン後にリダイレクトが localhost へ飛ぶ / Cookie が保存されない

**原因**: `BETTER_AUTH_URL` 未設定時に `http://localhost:3000` へフォールバックしていた。

**対処**: `src/server/auth/base-url.ts` を追加し、
`BETTER_AUTH_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → localhost の順で解決するようにした。
プレビューデプロイのドメインも `trustedOrigins` に自動追加される。

### ⑦ トップページが 500 になり「エラーが発生しました」だけが表示される

**原因**: `DATABASE_URL` か `BETTER_AUTH_SECRET` が未設定だと、
Server Component がセッション解決の時点で例外を投げる。
以前はエラー画面に情報が無く、原因の切り分けができなかった。

**再現方法**（ローカル）:

```bash
mv .env .env.disabled                       # Next.js は .env を自動で読むため退避する
BETTER_AUTH_SECRET=... npx next start       # DATABASE_URL を渡さずに起動
curl -o /dev/null -w '%{http_code}\n' localhost:3000/   # → 500
mv .env.disabled .env
```

**対処**: `/api/health` を追加し、エラー画面が自動でその結果を表示するようにした。
これにより「どの環境変数が足りないか」がブラウザ上で分かる。

## 14.4 まず `/api/health` を開く

デプロイ先で何か起きたら、最初にこれを開く。

```
https://<あなたのドメイン>/api/health
```

環境変数・DB 接続・マイグレーション・初期データを順に検査し、
**何が足りないかを日本語で返す**。ログを見に行かなくても切り分けられる。

```json
{
  "ok": false,
  "summary": "設定または初期化が完了していません。checks の error を解消してください。",
  "checks": [
    { "name": "DATABASE_URL", "status": "ok", "detail": "設定済み" },
    { "name": "BETTER_AUTH_SECRET", "status": "error", "detail": "未設定",
      "hint": "32 文字以上の値を設定してください（openssl rand -base64 32）。" },
    { "name": "マイグレーション適用", "status": "error",
      "detail": "The table `public.users` does not exist in the current database.",
      "hint": "npx prisma migrate deploy を本番 DB に対して実行してください。" }
  ]
}
```

- すべて `ok` なら HTTP 200、`error` があれば HTTP 503 を返す。
- **秘密情報は返さない**。接続文字列・鍵・個人情報は出力せず、
  エラー文中のホスト名・認証情報は伏字にする。正常時は件数も出さない。
- エラー画面（`error.tsx`）もこの結果を自動で取得し、
  設定不備があればその場に表示する。併せて表示される「エラーID」は
  Vercel の Runtime Logs の digest と一致するので、ログ照合に使える。

## 14.5 まだ起こりうる問題

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| **トップページで「エラーが発生しました」** | `DATABASE_URL` または `BETTER_AUTH_SECRET` が未設定 | `/api/health` で確認 → Vercel に設定して**再デプロイ** |
| `relation "users" does not exist` | マイグレーション未適用 | 14.2 の手順 1 を実行 |
| ログインできるが画面が空 | マスタ未投入 | 14.2 の手順 2 を実行 |
| `too many connections` | プーラーを通していない | 接続文字列を `-pooler` 付きに変更 |
| `TlsConnectionError` | `sslmode` 未指定 | `?sslmode=require` を付与 |
| 502 / タイムアウト | 関数のメモリ・時間不足 | Vercel の Function 設定を引き上げる |

## 14.6 ローカルで Vercel 相当の検証をする

```bash
# クリーンクローン + npm ci + 環境変数なしビルド（Vercel と同条件）
git clone <repo> /tmp/verify && cd /tmp/verify
npm ci
env -u DATABASE_URL -u BETTER_AUTH_SECRET npm run build
```

これが通れば、少なくともビルド時に落ちる問題は無い。
