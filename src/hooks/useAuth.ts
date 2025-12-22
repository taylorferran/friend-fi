'use client';

import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_AUTH_KEY = 'friendfi_biometric_authenticated';

/**
 * Auth hook for biometric authentication only
 */
export function useAuth() {
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);

  // Check auth status
  const checkAuth = useCallback(() => {
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true';
      setBiometricAuthenticated(isAuth);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    
    // Listen for storage changes (when login happens in another component)
    const handleStorageChange = () => {
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom auth events
    const handleAuthChange = () => {
      checkAuth();
    };
    
    window.addEventListener('auth-changed', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, [checkAuth]);

  // Logout function for biometric auth
  const logout = () => {
    localStorage.removeItem(BIOMETRIC_AUTH_KEY);
    setBiometricAuthenticated(false);
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('auth-changed'));
  };

  return {
    authenticated: biometricAuthenticated,
    ready: true, // Always ready - no need to wait for Privy
    logout,
    isPrivyAuth: false, // Always false - Privy removed
    isBiometricAuth: biometricAuthenticated,
  };
}

