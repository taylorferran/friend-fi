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
import { buildCreateGroupPayload, buildJoinGroupPayload, buildCreateBetPayload, buildPlaceWagerPayload, buildResolveBetPayload, buildSetProfilePayload, getGroupsCount, getBetsCount } from '@/lib/contract';

export function useMoveWallet() {
  const { isPrivyAuth, isBiometricAuth } = useAuth();
  const { wallet: privyWallet, signAndSubmitTransaction: privySign, isPrivyWallet } = useUnifiedMoveWallet();
  const [wallet, setWallet] = useState<MoveWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet - use Privy wallet if available, otherwise use localStorage wallet
  useEffect(() => {
    if (isPrivyWallet && privyWallet) {
      // Use Privy wallet
      setWallet(privyWallet);
      setLoading(false);
    } else if (isBiometricAuth) {
      // Use biometric wallet from localStorage
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
    } else {
      // Fallback: create/get wallet from localStorage (for demo/backward compatibility)
      try {
        const w = getOrCreateMoveWallet();
        setWallet(w);
        setLoading(false);
      } catch (err) {
        setError('Failed to initialize wallet');
        setLoading(false);
      }
    }
  }, [isPrivyWallet, privyWallet, isBiometricAuth]);

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
      // Get the current wallet from localStorage (in case it was switched)
      const currentWallet = getOrCreateMoveWallet();
      
      // The creator is automatically the admin
      const payload = buildCreateBetPayload(groupId, description, outcomes, currentWallet.address);
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

