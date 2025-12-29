'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getUserTransactions, AccountTransaction } from '@/lib/indexer';

// Movement testnet explorer base URL
const EXPLORER_URL = 'https://explorer.movementnetwork.xyz';

// Map common function names to user-friendly descriptions
const getFunctionDescription = (tx: AccountTransaction): string => {
  if (!tx.functionName) return 'Unknown Transaction';
  
  const funcName = tx.functionName;
  const module = tx.functionModule || '';
  
  // Profile functions
  if (funcName === 'set_profile') return 'Set Profile';
  
  // Group functions
  if (funcName === 'create_group') return 'Create Group';
  if (funcName === 'join_group') return 'Join Group';
  
  // Prediction functions
  if (funcName === 'create_bet') return 'Create Bet';
  if (funcName === 'place_wager') return 'Place Wager';
  if (funcName === 'add_to_wager') return 'Add to Wager';
  if (funcName === 'resolve_bet') return 'Resolve Bet';
  if (funcName === 'claim_payout') return 'Claim Payout';
  
  // USDC transfer
  if (funcName === 'transfer' && module === 'primary_fungible_store') return 'Transfer USDC';
  
  // Generic fallback - format the function name
  return funcName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Extract USDC amount from transaction events (if available)
// This is a simplified version - in production you'd parse transaction events
const getUSDCAmount = (tx: AccountTransaction): number | null => {
  // For now, we can't easily extract the USDC amount without parsing events
  // This would require additional indexer queries for transaction events
  return null;
};

export default function TransactionsPage() {
  const { authenticated } = useAuth();
  const { wallet, loading: walletLoading } = useMoveWallet();
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTransactions() {
      if (!wallet?.address) {
        console.log('No wallet address available yet');
        return;
      }
      
      console.log('Loading transactions for address:', wallet.address);
      setLoading(true);
      setError(null);
      
      try {
        const txs = await getUserTransactions(wallet.address, 50);
        console.log('Loaded transactions:', txs.length, 'transactions:', txs);
        setTransactions(txs);
      } catch (err) {
        console.error('Error loading transactions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load transaction history');
      } finally {
        setLoading(false);
      }
    }
    
    if (wallet?.address) {
      loadTransactions();
    }
  }, [wallet?.address]);

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  // Truncate hash for display
  const truncateHash = (hash: string): string => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  // Format version as transaction identifier
  const formatVersion = (version: number): string => {
    return `#${version}`;
  };

  // Show loading/auth prompt if not authenticated

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content lg:p-0 lg:py-16">
        <div className="p-4 sm:p-6 pt-8 pb-12 lg:p-8 lg:pt-0 lg:pb-0">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight">
                  Transaction History
                </h1>
                <p className="text-accent text-sm sm:text-base mt-1 font-mono">
                  {loading ? 'Loading...' : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} found`}
                </p>
                {wallet?.address && (
                  <p className="text-accent text-xs mt-1 font-mono break-all">
                    Wallet: {wallet.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary/20 border-2 border-text flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-secondary">error</span>
                </div>
                <h2 className="text-text text-xl font-display font-bold mb-2">Error Loading Transactions</h2>
                <p className="text-accent font-mono text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && !error && (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="brutalist-spinner-instant mx-auto mb-4">
                  
                  
                  
                  
                </div>
                <p className="text-accent font-mono text-sm">Loading transaction history...</p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !error && transactions.length === 0 && (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-20 h-20 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-accent">receipt</span>
                </div>
                <h2 className="text-text text-2xl font-display font-bold mb-3">No Transactions Yet</h2>
                <p className="text-accent max-w-md mx-auto font-mono">
                  Your transaction history will appear here once you start using Friend-Fi.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Transactions List */}
          {!loading && !error && transactions.length > 0 && (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const description = getFunctionDescription(tx);
                const usdcAmount = getUSDCAmount(tx);
                const explorerUrl = `${EXPLORER_URL}/txn/${tx.version}?network=testnet`;
                
                return (
                  <Card key={tx.version} hover>
                    <CardContent className="p-0">
                      <a 
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 sm:p-4 hover:bg-primary/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                          {/* Left: Icon + Details */}
                          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                            {/* Icon */}
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 border-2 border-text flex items-center justify-center ${
                              tx.success ? 'bg-primary' : 'bg-secondary/20'
                            }`}>
                              <span className={`material-symbols-outlined text-lg sm:text-xl ${
                                tx.success ? 'text-text' : 'text-secondary'
                              }`}>
                                {tx.success ? 'check_circle' : 'cancel'}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="text-text font-display font-bold text-sm sm:text-base truncate">
                                  {description}
                                </h3>
                                {!tx.success && (
                                  <span className="text-secondary text-[10px] sm:text-xs font-mono font-bold uppercase px-1.5 sm:px-2 py-0.5 border border-secondary flex-shrink-0">
                                    Failed
                                  </span>
                                )}
                              </div>
                              
                              <div className="space-y-1">
                                {/* Transaction Version */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-accent text-xs font-mono break-all">
                                    Transaction {formatVersion(tx.version)}
                                  </span>
                                  <span className="material-symbols-outlined text-accent text-sm flex-shrink-0">open_in_new</span>
                                </div>
                                
                                {/* Module (if available) */}
                                {tx.functionModule && (
                                  <p className="text-accent text-xs font-mono break-all">
                                    {tx.functionModule}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Amount + Time */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {usdcAmount !== null && (
                              <span className="text-text font-mono font-bold">
                                ${(usdcAmount / 1_000_000).toFixed(2)}
                              </span>
                            )}
                            <span className="text-accent text-xs font-mono">
                              {formatTimestamp(tx.timestamp)}
                            </span>
                          </div>
                        </div>
                      </a>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Info Card */}
          {!loading && !error && transactions.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-accent text-xl flex-shrink-0">info</span>
                  <div>
                    <p className="text-accent text-sm font-mono mb-1">
                      Click any transaction to view full details on the Movement Explorer.
                    </p>
                    <p className="text-accent text-xs font-mono">
                      Showing up to 50 most recent transactions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

