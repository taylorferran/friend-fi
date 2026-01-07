'use client';

import { useEffect, useState } from 'react';

const BIOMETRIC_AUTH_KEY = 'friendfi_biometric_authenticated';

/**
 * Biometric-only auth wrapper using WebAuthn
 * No redirects - all routes are accessible, auth state is just tracked
 */
export function BiometricAuthWrapper({ children }: { children: React.ReactNode }) {
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);

  // Check biometric auth status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true';
      setBiometricAuthenticated(isAuth);
      setReady(true);
    }
  }, []);

  // Listen for auth changes (when user logs in/out)
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true';
      setBiometricAuthenticated(isAuth);
    };

    // Listen for storage changes (other tabs)
    window.addEventListener('storage', checkAuth);
    
    // Listen for custom auth-changed event (same tab)
    window.addEventListener('auth-changed', checkAuth);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('auth-changed', checkAuth);
    };
  }, []);

  // Show loading only on initial mount
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin">
          
          
          
          
        </div>
      </div>
    );
  }

  // Always show content - no redirects
  return <>{children}</>;
}

