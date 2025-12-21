'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/demo', '/demo-habits', '/demo-predictions', '/demo-expenses', '/demo-selector'];
const BIOMETRIC_AUTH_KEY = 'friendfi_biometric_authenticated';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { ready, authenticated: privyAuthenticated } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();
  const [showContent, setShowContent] = useState(false);
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);

  // Check if route is public (exact match or starts with /demo)
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/demo');

  // Check biometric auth status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBiometricAuthenticated(localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true');
    }
  }, []);

  // User is authenticated if either Privy OR biometric auth is active
  const authenticated = privyAuthenticated || biometricAuthenticated;

  useEffect(() => {
    if (!ready && !biometricAuthenticated) return;

    if (authenticated) {
      // User is logged in (via Privy or biometric) - show content for any route
      setShowContent(true);
    } else {
      // User is not logged in
      if (!isPublicRoute) {
        // Redirect to homepage (login is handled there via modal)
        router.replace('/');
      } else {
        // User is on public route, show content
        setShowContent(true);
      }
    }
  }, [ready, authenticated, biometricAuthenticated, pathname, router, isPublicRoute]);

  // For public routes, don't block - they handle their own loading
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, wait until ready (or biometric auth) and content should show
  if ((!ready && !biometricAuthenticated) || !showContent) {
    // Return null - the PrivyProvider's LoadingFallback handles this for Privy users
    // Biometric users don't need Privy to be ready
    return null;
  }

  return <>{children}</>;
}

