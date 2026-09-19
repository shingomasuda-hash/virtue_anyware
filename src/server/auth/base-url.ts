/**
 * 公開 URL の解決。
 *
 * Vercel では本番・プレビューでドメインが変わるため、`BETTER_AUTH_URL` を
 * 明示設定していない場合に Vercel の提供する環境変数から組み立てる。
 * これを怠ると baseURL が localhost のままになり、
 * ログイン後のリダイレクトと Cookie の発行が本番で壊れる。
 *
 * 優先順位:
 *   1. BETTER_AUTH_URL                    … 明示設定（推奨）
 *   2. VERCEL_PROJECT_PRODUCTION_URL      … 本番ドメイン（Vercel が自動設定）
 *   3. VERCEL_URL                         … デプロイごとの URL（プレビュー）
 *   4. http://localhost:3000              … ローカル開発
 */
export function resolveBaseUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) return `https://${stripProtocol(productionHost)}`;

  const deploymentHost = process.env.VERCEL_URL?.trim();
  if (deploymentHost) return `https://${stripProtocol(deploymentHost)}`;

  return 'http://localhost:3000';
}

/** プレビューデプロイでも自分自身のオリジンを信頼できるようにする。 */
export function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>([resolveBaseUrl()]);
  for (const host of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    if (host?.trim()) origins.add(`https://${stripProtocol(host.trim())}`);
  }
  return [...origins];
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function stripProtocol(host: string): string {
  return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
