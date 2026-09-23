# 12. セキュリティ設計

| 脅威 | 対策 |
| --- | --- |
| 認証 | Better Auth（stable）。scrypt によるパスワードハッシュ、最小12文字＋複雑性チェック |
| セッション | httpOnly / Secure / SameSite=Lax cookie、署名付き、既定7日・更新1日、ログアウトで失効 |
| 認可 | `AccessContext` を全 repository に必須化。`findFirst({id, ...scope})` で IDOR を封じる |
| テナント分離 | `organization_id` + `agency_id` を where で強制。集計クエリにも適用 |
| フィールド秘匿 | 本部財務フィールドは service 層で除去（UI 非表示に依存しない） |
| CSRF | Server Actions は Next.js の Origin 検証を利用。Better Auth も CSRF トークンを内蔵。状態変更は GET で行わない |
| XSS | React の自動エスケープ。`dangerouslySetInnerHTML` 禁止（ESLint で検出）。CSP ヘッダを `next.config.ts` で付与 |
| SQL Injection | Prisma のパラメータ化クエリのみ。`$queryRawUnsafe` 禁止（`$queryRaw` タグ付きテンプレートのみ許可） |
| レート制御 | ログインは Better Auth の rateLimit（IP+email、10req/min）。CSV取込・エクスポートにも上限 |
| 入力検証 | 全 Server Action / Route Handler で Zod。CSV は行単位で型・必須・形式を検証 |
| ファイルアップロード | 拡張子/MIME/サイズ(20MB)を検証。CSV はテキストとしてのみ解釈し実行しない |
| ログ | `audit_logs` に actor / action / entity / before / after / ip / UA。財務・単価・キャンセルは before/after 必須 |
| PII | 電話・住所・生年月日は一覧では部分マスク（`090-****-1234`）、詳細で権限がある場合のみ全表示。エクスポートは `export:csv` 権限＋監査ログ必須 |
| 秘密情報 | `.env` は `.gitignore`。`.env.example` のみコミット。`BETTER_AUTH_SECRET` は環境変数 |
| セキュリティヘッダ | `X-Frame-Options: DENY` / `X-Content-Type-Options: nosniff` / `Referrer-Policy: strict-origin-when-cross-origin` / `Permissions-Policy` / HSTS（本番） |
| エラー | 認証失敗は原因を明かさない汎用メッセージ。スタックトレースをクライアントへ返さない |

## パスワードポリシー
12文字以上128文字以内、英大文字・小文字・数字・記号のうち3種以上。
よくあるパスワード・同一文字の繰り返しを拒否。

判定は `src/lib/password.ts` の 1 箇所だけに置き、
ユーザー登録フォーム・管理者によるパスワード再設定・本人によるパスワード変更・
初期化スクリプト（`scripts/bootstrap.ts`）がすべてここを参照する。
場所によって強度が異なる状態を作らない。

| 操作 | 実行者 | 現在のパスワード確認 | セッションの扱い |
| --- | --- | --- | --- |
| 本人によるパスワード変更 `/account` `/agency/account` | 本人（全ロール） | 必要（Better Auth が検証） | 他端末のセッションを失効 |
| 管理者によるパスワード再設定 `/users/[id]/edit` | `user:manage` 保持者 | 不要 | 対象ユーザーの全セッションを失効 |
| ユーザーの無効化 `/users/[id]/edit` | `user:manage` 保持者 | — | 対象ユーザーの全セッションを失効。以後はセッションを発行しない |

無効化は Better Auth の `databaseHooks.session.create.before` で弾く。
既存セッションを消すだけでは、正しいパスワードで再ログインされたときに
新しいセッションが発行されてしまうため、発行そのものを止める。
ログイン画面には原因を明かさない汎用メッセージを返す（アカウント列挙対策 §31）。

## ユーザー管理のサーバー側ガード
画面で選択肢を出し分けるだけでなく、`src/server/services/users.ts` で同じ判定を行う。

| ガード | 内容 |
| --- | --- |
| 権限昇格の防止 | `SUPER_ADMIN` の作成・変更・パスワード再設定は `SUPER_ADMIN` のみ |
| 所属の強制 | 代理店ロールには自組織の代理店の指定が必須。本部ロールには代理店を紐づけない |
| 自分自身の締め出し防止 | 自分の無効化・自分のロール変更を禁止 |
| 最後の管理者の保護 | 組織に有効な管理者が 0 人になる無効化・降格を禁止 |
| 組織分離（§4） | 一覧・詳細・更新・再設定のすべてを `organizationId` で絞り込み、ID 直接指定でも他組織へ到達できない |

## 監査対象アクション（§27）
`customer.update` / `contract.update` / `contract.cancel` / `pricing.update` /
`agency.create` / `agency.update` / `import.commit` / `import.rollback` /
`settlement.confirm` / `expense.approve` / `user.create` / `user.role_change` /
`user.password_reset` / `user.password_change` / `export.csv`
