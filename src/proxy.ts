import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple pass-through proxy - no subdomain routing needed
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

