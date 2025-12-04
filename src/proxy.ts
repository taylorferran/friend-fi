import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Skip proxy in development (localhost) - Privy embedded wallets require HTTPS
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
  if (isLocalhost) {
    return NextResponse.next();
  }

  // Production only: Check if we're on the app subdomain
  const isAppSubdomain = hostname.startsWith('app.');

  // Production only: Check if we're on the main domain
  const isMainDomain = hostname === 'friend-fi.com' || hostname === 'www.friend-fi.com';

  // If on app subdomain and trying to access splash page, redirect to dashboard
  if (isAppSubdomain && url.pathname === '/') {
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // If on main domain and trying to access dashboard/app routes, redirect to app subdomain
  if (isMainDomain && (url.pathname.startsWith('/dashboard') || 
                       url.pathname.startsWith('/groups') ||
                       url.pathname.startsWith('/bets') ||
                       url.pathname.startsWith('/leaderboard') ||
                       url.pathname.startsWith('/settings') ||
                       url.pathname.startsWith('/login') ||
                       url.pathname.startsWith('/expenses') ||
                       url.pathname.startsWith('/accountability'))) {
    // Replace hostname with app subdomain
    const appHostname = hostname.replace(/^(www\.)?/, 'app.');
    url.hostname = appHostname;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

