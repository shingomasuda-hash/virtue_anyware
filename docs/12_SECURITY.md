# 12. セキュリティ設計

| 脅威 | 対策 |
| --- | --- |
| 認証 | Better Auth（stable）。scrypt によるパスワードハッシュ、最小8文字＋複雑性チェック |
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
8文字以上、英大文字・小文字・数字・記号のうち3種以上。よくあるパスワードを拒否。

## 監査対象アクション（§27）
`customer.update` / `contract.update` / `contract.cancel` / `pricing.update` /
`agency.create` / `agency.update` / `import.commit` / `import.rollback` /
`settlement.confirm` / `expense.approve` / `user.role_change` / `export.csv`
