'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

const BIOMETRIC_AUTH_KEY = 'friendfi_biometric_authenticated';

/**
 * Combined auth hook that checks both Privy and biometric authentication
 */
export function useAuth() {
  const { authenticated: privyAuthenticated, ready: privyReady, user, logout: privyLogout } = usePrivy();
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBiometricAuthenticated(localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true');
    }
  }, []);

  // User is authenticated if either Privy OR biometric auth is active
  const authenticated = privyAuthenticated || biometricAuthenticated;
  
  // Ready when Privy is ready OR when biometric is authenticated (biometric doesn't need Privy)
  const ready = privyReady || biometricAuthenticated;

  // Logout function that handles both Privy and biometric
  const logout = () => {
    if (privyAuthenticated) {
      privyLogout();
    }
    if (biometricAuthenticated) {
      localStorage.removeItem(BIOMETRIC_AUTH_KEY);
      setBiometricAuthenticated(false);
    }
  };

  return {
    authenticated,
    ready,
    user, // Only available for Privy users
    logout,
    isPrivyAuth: privyAuthenticated,
    isBiometricAuth: biometricAuthenticated,
  };
}

