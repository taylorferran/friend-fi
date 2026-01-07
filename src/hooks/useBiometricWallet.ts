'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  registerBiometricWallet,
  authenticateBiometricWallet,
  hasBiometricWallet,
  removeBiometricWallet,
} from '@/lib/biometric-wallet';
import { useToast } from '@/components/ui/Toast';

const BIOMETRIC_AUTH_KEY = 'friendfi_biometric_authenticated';

export function useBiometricWallet() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if biometric wallet is registered and if user is authenticated
  useEffect(() => {
    setIsRegistered(hasBiometricWallet());
    setIsAuthenticated(localStorage.getItem(BIOMETRIC_AUTH_KEY) === 'true');
  }, []);

  // Check if biometric wallet is registered
  useEffect(() => {
    setIsRegistered(hasBiometricWallet());
  }, []);

  // Register biometric wallet with WebAuthn
  const register = useCallback(async (): Promise<boolean> => {
    setIsRegistering(true);
    setError(null);

    try {
      // Step 1: Register biometric and get Move private key (Ed25519)
      const { privateKey, address } = await registerBiometricWallet();
      
      // Step 2: Store Move wallet in localStorage (for Move transactions)
      const moveWallet = {
        address,
        privateKeyHex: privateKey,
      };
      localStorage.setItem('friendfi_move_wallet', JSON.stringify(moveWallet));

      // Step 3: Mark user as authenticated with biometric auth
      localStorage.setItem(BIOMETRIC_AUTH_KEY, 'true');
      setIsRegistered(true);
      setIsAuthenticated(true);

      // Trigger auth-changed event for immediate UI updates
      window.dispatchEvent(new Event('auth-changed'));

      showToast({
        type: 'success',
        title: 'Biometric wallet created!',
        message: 'Welcome! You can now log in with Face ID/Touch ID',
      });
      
      // Don't redirect - let the dashboard refresh in place
      // router.push('/dashboard');
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register biometric wallet';
      setError(message);
      showToast({
        type: 'error',
        title: 'Registration failed',
        message,
      });
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [router, showToast]);

  // Authenticate with biometric using WebAuthn
  const authenticate = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // Step 1: Authenticate biometric and get Move private key (Ed25519)
      const { privateKey, address } = await authenticateBiometricWallet();
      
      // Step 2: Store Move wallet in localStorage (for Move transactions)
      const moveWallet = {
        address,
        privateKeyHex: privateKey,
      };
      localStorage.setItem('friendfi_move_wallet', JSON.stringify(moveWallet));

      // Step 3: Mark user as authenticated with biometric auth
      localStorage.setItem(BIOMETRIC_AUTH_KEY, 'true');
      setIsAuthenticated(true);

      // Trigger auth-changed event for immediate UI updates
      window.dispatchEvent(new Event('auth-changed'));

      showToast({
        type: 'success',
        title: 'Logged in!',
        message: 'Welcome back',
      });
      
      // Don't redirect - let the dashboard refresh in place
      // router.push('/dashboard');
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Biometric authentication failed';
      
      // If no passkey found or passkey doesn't match, clear old data and prompt re-registration
      if (message.includes('passkey') || message.includes('credential') || message.includes('No biometric wallet')) {
        console.log('[BiometricWallet] Old/mismatched passkey detected, clearing data...');
        removeBiometricWallet();
        localStorage.removeItem(BIOMETRIC_AUTH_KEY);
        setIsRegistered(false);
        setIsAuthenticated(false);
        
        showToast({
          type: 'error',
          title: 'Passkey outdated',
          message: 'Please register again with your biometric',
        });
      } else {
        setError(message);
        showToast({
          type: 'error',
          title: 'Authentication failed',
          message,
        });
      }
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [router, showToast]);

  // Remove biometric wallet
  const remove = useCallback(() => {
    removeBiometricWallet();
    localStorage.removeItem(BIOMETRIC_AUTH_KEY);
    setIsRegistered(false);
    setIsAuthenticated(false);
    showToast({
      type: 'success',
      title: 'Biometric wallet removed',
    });
  }, [showToast]);

  return {
    isRegistered,
    isAuthenticated,
    isRegistering,
    isAuthenticating,
    error,
    register,
    authenticate,
    remove,
  };
}

