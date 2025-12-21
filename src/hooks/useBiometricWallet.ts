'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useImportWallet } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import {
  registerBiometricWallet,
  authenticateBiometricWallet,
  hasBiometricWallet,
  removeBiometricWallet,
} from '@/lib/biometric-wallet';
import { useToast } from '@/components/ui/Toast';

export function useBiometricWallet() {
  const { ready } = usePrivy();
  const { importWallet } = useImportWallet();
  const router = useRouter();
  const { showToast } = useToast();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if biometric wallet is registered
  useEffect(() => {
    setIsRegistered(hasBiometricWallet());
  }, []);

  // Register biometric wallet and import to Privy
  const register = useCallback(async (): Promise<boolean> => {
    setIsRegistering(true);
    setError(null);

    try {
      // Step 1: Register biometric and get Move private key (Ed25519)
      const { privateKey, address } = await registerBiometricWallet();
      
      // Step 2: Import Move wallet into Privy (Privy supports Movement network with Ed25519)
      // Remove 0x prefix if present for import
      const privateKeyForImport = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      
      await importWallet({
        privateKey: privateKeyForImport,
      });
      
      // Step 3: Store Move wallet in localStorage (for Move transactions)
      // This replaces the existing Move wallet with the biometric-derived one
      const moveWallet = {
        address,
        privateKeyHex: privateKey,
      };
      localStorage.setItem('friendfi_move_wallet', JSON.stringify(moveWallet));

      setIsRegistered(true);
      showToast({
        type: 'success',
        title: 'Biometric wallet created!',
        message: 'Welcome! You can now log in with Face ID/Touch ID',
      });
      
      // Redirect to dashboard after successful registration
      router.push('/dashboard');
      
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
  }, [importWallet, showToast]);

  // Authenticate with biometric and restore Privy wallet
  const authenticate = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // Step 1: Authenticate biometric and get Move private key (Ed25519)
      const { privateKey, address } = await authenticateBiometricWallet();
      
      // Step 2: Import Move wallet into Privy (Privy supports Movement network with Ed25519)
      // Remove 0x prefix if present for import
      const privateKeyForImport = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      
      await importWallet({
        privateKey: privateKeyForImport,
      });
      
      // Step 3: Store Move wallet in localStorage (for Move transactions)
      const moveWallet = {
        address,
        privateKeyHex: privateKey,
      };
      localStorage.setItem('friendfi_move_wallet', JSON.stringify(moveWallet));

      showToast({
        type: 'success',
        title: 'Logged in!',
        message: 'Welcome back',
      });
      
      // Redirect to dashboard
      router.push('/dashboard');
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Biometric authentication failed';
      setError(message);
      showToast({
        type: 'error',
        title: 'Authentication failed',
        message,
      });
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [importWallet, router, showToast]);

  // Remove biometric wallet
  const remove = useCallback(() => {
    removeBiometricWallet();
    setIsRegistered(false);
    showToast({
      type: 'success',
      title: 'Biometric wallet removed',
    });
  }, [showToast]);

  return {
    isRegistered,
    isRegistering,
    isAuthenticating,
    error,
    register,
    authenticate,
    remove,
    ready,
  };
}

