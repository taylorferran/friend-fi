'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  getOrCreateMoveWallet, 
  getWalletBalance, 
  signAndSubmitTransaction,
  type MoveWallet 
} from '@/lib/move-wallet';
import { buildCreateGroupPayload, buildJoinGroupPayload, buildCreateBetPayload, buildPlaceWagerPayload, buildResolveBetPayload, buildSetProfilePayload, getGroupsCount, getBetsCount } from '@/lib/contract';

export function useMoveWallet() {
  const [wallet, setWallet] = useState<MoveWallet | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet
  useEffect(() => {
    try {
      const w = getOrCreateMoveWallet();
      setWallet(w);
      setLoading(false);
    } catch (err) {
      setError('Failed to initialize wallet');
      setLoading(false);
    }
  }, []);

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

  // Create a group on-chain
  const createGroup = useCallback(async (name: string, password: string) => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    setError(null);
    try {
      const payload = buildCreateGroupPayload(name, password);
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
  }, [wallet]);

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
  }, [wallet]);

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
  }, [wallet]);

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
  }, [wallet]);

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
  }, [wallet]);

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
  };
}

