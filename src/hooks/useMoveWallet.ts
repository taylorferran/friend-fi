'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  getOrCreateMoveWallet, 
  getWalletBalance, 
  signAndSubmitTransaction,
  type MoveWallet 
} from '@/lib/move-wallet';
import { buildCreateGroupPayload, buildJoinGroupPayload, getGroupsCount } from '@/lib/contract';

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

  return {
    wallet,
    balance,
    loading,
    error,
    refreshBalance,
    createGroup,
    joinGroup,
  };
}

