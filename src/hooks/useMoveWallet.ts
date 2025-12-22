'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  getOrCreateMoveWallet, 
  getWalletBalance, 
  signAndSubmitTransaction as signDirectly,
  type MoveWallet 
} from '@/lib/move-wallet';
import { buildCreateGroupPayload, buildJoinGroupPayload, buildCreateBetPayload, buildPlaceWagerPayload, buildResolveBetPayload, buildSetProfilePayload, getGroupsCount, getBetsCount } from '@/lib/contract';

export function useMoveWallet() {
  const { isBiometricAuth } = useAuth();
  const [wallet, setWallet] = useState<MoveWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet - use biometric wallet if available, otherwise create/load localStorage wallet
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
    
    // Priority 2: Fallback wallet (if not using biometric)
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

  // Use direct signing (biometric or localStorage wallet)
  const signAndSubmitTransaction = useCallback(async (
    payload: {
      function: `${string}::${string}::${string}`;
      typeArguments: string[];
      functionArguments: (string | string[])[];
    }
  ): Promise<{ hash: string; success: boolean }> => {
    return signDirectly(payload);
  }, []);

  // Create a group on-chain
  const createGroup = useCallback(async (name: string, password: string, description: string = '') => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      const payload = buildCreateGroupPayload(name, password, description);
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

  // Join a group on-chain
  const joinGroup = useCallback(async (groupId: number, password: string) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      const payload = buildJoinGroupPayload(groupId, password);
      const result = await signAndSubmitTransaction(payload);
      
      if (!result.success) {
        throw new Error('Transaction failed');
      }
      
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join group';
      setError(message);
      throw err;
    }
  }, [wallet, signAndSubmitTransaction]);

  // Create a bet on-chain
  const createBet = useCallback(async (groupId: number, description: string, outcomes: string[]) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      // Use the wallet from state (could be Privy or biometric)
      // Don't get from localStorage as it might be a different wallet
      
      // The creator is automatically the admin
      const payload = buildCreateBetPayload(groupId, description, outcomes, wallet.address);
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

  // Place a wager on a bet
  const placeWager = useCallback(async (betId: number, outcomeIndex: number, amount: number) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      const payload = buildPlaceWagerPayload(betId, outcomeIndex, amount);
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
      const payload = buildSetProfilePayload(name, avatarId);
      const result = await signAndSubmitTransaction(payload);
      
      if (!result.success) {
        throw new Error('Transaction failed');
      }
      
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set profile';
      setError(message);
      throw err;
    }
  }, [wallet, signAndSubmitTransaction]);

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
  };
}

