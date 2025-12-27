'use client';

import { useState, useEffect } from 'react';

const BIOMETRIC_AUTH_KEY = 'friendfi_biometric_authenticated';

/**
 * Biometric-only auth hook (no Privy dependency)
 */
export function useAuth() {
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true';
      setBiometricAuthenticated(isAuth);
      setReady(true);
    }
  }, []);

  // Listen for auth changes (both storage and custom events)
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

  // Logout function
  const logout = () => {
      localStorage.removeItem(BIOMETRIC_AUTH_KEY);
    localStorage.removeItem('friendfi_move_wallet');
    localStorage.removeItem('friendfi_user_settings');
      setBiometricAuthenticated(false);
    
    // Trigger events for UI updates
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('auth-changed'));
  };

  return {
    authenticated: biometricAuthenticated,
    ready,
    user: null, // No user object for biometric auth
    logout,
    isBiometricAuth: biometricAuthenticated,
  };
}

