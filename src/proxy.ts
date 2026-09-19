import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * 未ログインを /login へ誘導する（UX 目的）。
 * **本当の認可はページ / Server Action / repository 側で行う**（proxy だけに頼らない）。
 *
 * Next.js 16 で `middleware` は `proxy` へ改名された（`middleware` は非推奨）。
 * proxy は CDN 側で実行されうるため、ここでは共有モジュールや DB に依存しない
 * Cookie の有無チェックだけを行う。
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request, { cookiePrefix: 'virtue' });
  if (!sessionCookie) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/customers/:path*',
    '/contracts/:path*',
    '/agencies/:path*',
    '/settings/:path*',
    '/agency/:path*',
  ],
};
