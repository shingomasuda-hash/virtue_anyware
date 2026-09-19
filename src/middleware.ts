import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * 未ログインを /login へ誘導する（UX 目的）。
 * **本当の認可はページ / Server Action / repository 側で行う**（middleware だけに頼らない）。
 */
export function middleware(request: NextRequest) {
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
