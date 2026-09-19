import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // 本番のみ HSTS を付与する（ローカルの http 開発を壊さないため）
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Prisma とドライバアダプタはバンドルせず Node の require に任せる
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],

  /**
   * Prisma 7 のクエリコンパイラ（WASM）を serverless バンドルへ含める。
   *
   * 生成先を `src/generated/prisma` にしているため Next.js のファイルトレースが
   * `query_compiler_fast_bg.wasm` を検出できず、Vercel 実行時に
   * Prisma の初期化が失敗する（ビルドは通るのでビルドログには出ない）。
   */
  outputFileTracingIncludes: {
    '/**': ['./src/generated/prisma/**/*'],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
