import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Redirect app subdomain root to dashboard
export function proxy(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;
  
  // If we're on the app subdomain and visiting the root, redirect to dashboard
  if (hostname.startsWith('app.') && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

