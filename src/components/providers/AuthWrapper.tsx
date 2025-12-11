'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/demo'];

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();
  const [showContent, setShowContent] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!ready) return;

    if (authenticated) {
      // User is logged in - show content for any route
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
  }, [ready, authenticated, pathname, router, isPublicRoute]);

  // For public routes, don't block - they handle their own loading
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, wait until ready and content should show
  if (!ready || !showContent) {
    // Return null - the PrivyProvider's LoadingFallback handles this
    return null;
  }

  return <>{children}</>;
}

