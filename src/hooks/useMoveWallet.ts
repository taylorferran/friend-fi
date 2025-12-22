'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUnifiedMoveWallet } from '@/hooks/usePrivyMoveWallet';
import { 
  getOrCreateMoveWallet, 
  getWalletBalance, 
  signAndSubmitTransaction as signDirectly,
  type MoveWallet 
} from '@/lib/move-wallet';
import { buildCreateBetPayload, buildPlaceWagerPayload, buildResolveBetPayload, getGroupsCount, getBetsCount, CONTRACT_ADDRESS, GROUPS_MODULE } from '@/lib/contract';

export function useMoveWallet() {
  const { isPrivyAuth, isBiometricAuth } = useAuth();
  const { wallet: privyWallet, signAndSubmitTransaction: privySign, isPrivyWallet } = useUnifiedMoveWallet();
  const [wallet, setWallet] = useState<MoveWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet - use Privy wallet if available, otherwise use localStorage wallet
  // CRITICAL: Never create a fallback wallet if Privy is authenticated or loading
  useEffect(() => {
    // Priority 1: Privy wallet (if available and authenticated)
    if (isPrivyWallet && privyWallet) {
      // Use Privy wallet - this is the primary method
      // Clear any localStorage wallet reference to prevent confusion
      setWallet(privyWallet);
      setLoading(false);
      return; // Exit early - don't check other sources
    }
    
    // Priority 2: Wait for Privy if authenticated (don't load fallback)
    if (isPrivyAuth && !privyWallet) {
      // Privy is authenticated but wallet not ready yet - wait, don't create fallback
      setLoading(true);
      // Don't set wallet to null here - wait for Privy wallet to load
      return; // Exit early - don't load fallback wallet
    }
    
    // Priority 3: Biometric wallet (only if Privy is NOT authenticated)
    if (isBiometricAuth && !isPrivyAuth) {
      // Use biometric wallet from localStorage - only if Privy is not available
      try {
        const stored = localStorage.getItem('friendfi_move_wallet');
        if (stored) {
          const w = JSON.parse(stored);
          setWallet(w);
        } else {
          setWallet(null);
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load biometric wallet');
        setLoading(false);
      }
      return; // Exit early
    }
    
    // Priority 4: Fallback wallet (only if neither Privy nor biometric)
    // Only create if Privy is NOT being used
    if (!isPrivyAuth && !isBiometricAuth) {
      try {
        const w = getOrCreateMoveWallet();
        setWallet(w);
        setLoading(false);
      } catch (err) {
        setError('Failed to initialize wallet');
        setLoading(false);
      }
    } else {
      // If we get here, we're waiting for a wallet to load
      setLoading(true);
    }
  }, [isPrivyWallet, privyWallet, isBiometricAuth, isPrivyAuth]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!wallet) return;
    try {
      const bal = await getWalletBalance(wallet.address);
      setBalance(bal);
    } catch {
      // Ignore errors - wallet might not be funded yet
    }
  }, [wallet]);

  // Fetch balance on wallet init
  useEffect(() => {
    if (wallet) {
      refreshBalance();
    }
  }, [wallet, refreshBalance]);

  // Use Privy signing if available, otherwise direct signing
  const signAndSubmitTransaction = useCallback(async (
    payload: {
      function: `${string}::${string}::${string}`;
      typeArguments: string[];
      functionArguments: (string | string[])[];
    }
  ): Promise<{ hash: string; success: boolean }> => {
    if (isPrivyWallet && privySign) {
      return privySign(payload);
    }
    return signDirectly(payload);
  }, [isPrivyWallet, privySign]);

  // Create a group on-chain
  const createGroup = useCallback(async (name: string, password: string, description: string = '') => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      // New simplified contract - only needs signer (no parameters)
      // Metadata (name, description, password) will be saved to Supabase by the calling code
      const payload = {
        function: `${CONTRACT_ADDRESS}::${GROUPS_MODULE}::create_group` as `${string}::${string}::${string}`,
        typeArguments: [],
        functionArguments: [], // No arguments for new simplified contract
      };
      
      const result = await signAndSubmitTransaction(payload);
      
      if (!result.success) {
        throw new Error('Transaction failed');
      }
      
      // Get the new group ID (it's the count - 1 after creation)
      const count = await getGroupsCount();
      return {
        hash: result.hash,
        groupId: count - 1,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create group';
      setError(message);
      throw err;
    }
  }, [wallet, signAndSubmitTransaction]);

  // Join a group - now 100% off-chain (Supabase)
  const joinGroup = useCallback(async (groupId: number, password: string) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      // Import Supabase functions dynamically
      const { addGroupMember, verifyGroupPassword } = await import('@/lib/supabase-services');
      const { hashPassword } = await import('@/lib/crypto');
      
      // Verify password
      const passwordHash = await hashPassword(password);
      const isValid = await verifyGroupPassword(groupId, passwordHash);
      
      if (!isValid) {
        throw new Error('Invalid group password');
      }
      
      // Add member to Supabase
      await addGroupMember(groupId, wallet.address);
      
      // Return success (no on-chain transaction)
      return {
        hash: 'supabase-join',
        success: true,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join group';
      setError(message);
      throw err;
    }
  }, [wallet]);

  // Create a bet on-chain
  const createBet = useCallback(async (
    groupId: number,
    description: string,
    outcomes: string[],
    signature: string,
    expiresAtMs: number
  ) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      // The creator is automatically the admin
      const payload = buildCreateBetPayload(
        groupId,
        signature,
        expiresAtMs,
        description,
        outcomes,
        wallet.address,
        []
      );
      const result = await signAndSubmitTransaction(payload);
      
      if (!result.success) {
        throw new Error('Transaction failed');
      }
      
      // Get the new bet ID (it's the count - 1 after creation)
      const count = await getBetsCount();
      return {
        hash: result.hash,
        betId: count - 1,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create bet';
      setError(message);
      throw err;
    }
  }, [wallet, signAndSubmitTransaction]);

  // Place a wager on a bet (with signature authentication)
  const placeWager = useCallback(async (
    betId: number,
    outcomeIndex: number,
    amount: number,
    signature: string,
    expiresAtMs: number
  ) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      const payload = buildPlaceWagerPayload(betId, outcomeIndex, amount, signature, expiresAtMs);
      const result = await signAndSubmitTransaction(payload);
      
      if (!result.success) {
        throw new Error('Transaction failed');
      }
      
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place wager';
      setError(message);
      throw err;
    }
  }, [wallet, signAndSubmitTransaction]);

  // Resolve a bet (only admin can do this)
  const resolveBet = useCallback(async (betId: number, winningOutcomeIndex: number) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      const payload = buildResolveBetPayload(betId, winningOutcomeIndex);
      const result = await signAndSubmitTransaction(payload);
      
      if (!result.success) {
        throw new Error('Transaction failed');
      }
      
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve bet';
      setError(message);
      throw err;
    }
  }, [wallet, signAndSubmitTransaction]);

  // Set user profile on-chain
  const setProfile = useCallback(async (name: string, avatarId: number) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      // Use Supabase instead of on-chain (profiles are now off-chain)
      const { upsertProfile } = await import('@/lib/supabase-services');
      await upsertProfile(wallet.address, name, avatarId);
      
      return {
        hash: 'off-chain', // No transaction hash for off-chain operation
        success: true,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set profile';
      setError(message);
      throw err;
    }
  }, [wallet]);

  return {
    wallet,
    balance,
    loading,
    error,
    refreshBalance,
    createGroup,
    joinGroup,
    createBet,
    placeWager,
    resolveBet,
    setProfile,
    signAndSubmitTransaction, // Export this so components can use it
  };
}

