'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  getOrCreateMoveWallet, 
  getWalletBalance, 
  signAndSubmitTransaction as signDirectly,
  type MoveWallet 
} from '@/lib/move-wallet';
import { buildCreateBetPayload, buildPlaceWagerPayload, buildResolveBetPayload, getGroupsCount, getBetsCount, CONTRACT_ADDRESS, GROUPS_MODULE } from '@/lib/contract';

export function useMoveWallet() {
  const { isBiometricAuth } = useAuth();
  const [wallet, setWallet] = useState<MoveWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet - use biometric wallet from localStorage or create fallback
  useEffect(() => {
    // Priority 1: Biometric wallet (if authenticated)
    if (isBiometricAuth) {
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
      return;
    }
    
    // Priority 2: Fallback wallet (for demo/testing)
    try {
      const w = getOrCreateMoveWallet();
      setWallet(w);
      setLoading(false);
    } catch (err) {
      setError('Failed to initialize wallet');
      setLoading(false);
    }
  }, [isBiometricAuth]);

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

  // Sign and submit transactions directly
  const signAndSubmitTransaction = useCallback(async (
    payload: {
      function: `${string}::${string}::${string}`;
      typeArguments: string[];
      functionArguments: (string | string[] | number[])[];
    }
  ): Promise<{ hash: string; success: boolean }> => {
    return signDirectly(payload);
  }, []);

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

  // Create a bet on-chain WITH mandatory initial wager
  const createBet = useCallback(async (
    groupId: number,
    description: string,
    outcomes: string[],
    signature: string,
    expiresAtMs: number,
    initialOutcomeIndex: number,
    initialWagerUSDC: number  // Amount in USDC (e.g., 0.05)
  ) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    // Verify minimum wager (0.05 USDC)
    if (initialWagerUSDC < 0.05) {
      throw new Error('Minimum wager is 0.05 USDC');
    }
    
    setError(null);
    try {
      // Convert USDC to micro-USDC (6 decimals)
      const initialWagerMicro = Math.floor(initialWagerUSDC * 1_000_000);
      
      // Build payload using new function
      const { buildCreateBetWithWagerPayload } = await import('@/lib/contract');
      const payload = buildCreateBetWithWagerPayload(
        groupId,
        signature,
        expiresAtMs,
        description,
        outcomes,
        wallet.address,  // admin
        [],  // encrypted_payload (empty)
        initialOutcomeIndex,
        initialWagerMicro
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

