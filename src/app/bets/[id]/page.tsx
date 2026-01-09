'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getBetData, getUserWager, getUserWagerOutcome, getProfiles, type BetData } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
import { requestMembershipSignature } from '@/lib/signature-service';

// Placeholder type since we're not using indexer (event queries take 60+ seconds)
interface BettorInfo {
  address: string;
  outcomeIndex: number;
  amount: number;
  payout?: number;
  isWinner?: boolean;
}

// Extended bettor info with profile data
interface BettorWithProfile extends BettorInfo {
  name?: string;
  avatarId?: number;
}

export default function ViewBetPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated } = useAuth();
  const { wallet, placeWager, resolveBet } = useMoveWallet();
  const betId = parseInt(params.id as string, 10);

  const { showToast } = useToast();

  const [bet, setBet] = useState<BetData | null>(null);
  const [userWager, setUserWager] = useState<number>(0);
  const [userOutcomeIndex, setUserOutcomeIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [wagerAmount, setWagerAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Bettor data from indexer
  const [bettors, setBettors] = useState<BettorWithProfile[]>([]);
  const [loadingBettors, setLoadingBettors] = useState(false);
  const [indexerError, setIndexerError] = useState(false);

  // Note: No redirect - allow viewing bets when not authenticated
  // Users will be prompted to login when trying to place a wager

  // NOTE: loadBettors disabled - indexer event queries take 60+ seconds
  // Individual bettor details won't be shown until indexer is faster
  const loadBettors = useCallback(async () => {
    // Skip the slow indexer query - just show that data isn't available
    setLoadingBettors(false);
    setIndexerError(true); // This will show "Indexer Unavailable" message
  }, []);

  // Load bet data - FAST on-chain first, indexer enhancements in background
  useEffect(() => {
    async function loadBet() {
      if (isNaN(betId)) {
        setLoading(false);
        return;
      }

      try {
        // Load bet data from on-chain (fast, parallel) - now includes description!
        const betData = await getBetData(betId);
        setBet(betData);

        // Get user's wager and outcome if wallet is connected
        if (wallet?.address && betData) {
          const [wager, wagerOutcome] = await Promise.all([
            getUserWager(betId, wallet.address),
            getUserWagerOutcome(betId, wallet.address)
          ]);
          setUserWager(wager);
          if (wagerOutcome.hasWager) {
            setUserOutcomeIndex(wagerOutcome.outcomeIndex);
          }
        }

      } catch (error) {
        console.error('Error loading bet:', error);
      } finally {
        setLoading(false);
      }
    }

    loadBet();
    loadBettors();
  }, [betId, wallet?.address, loadBettors]);

  const handlePlaceWager = async () => {
    if (selectedOutcome === null || !wagerAmount || !wallet || !bet) return;
    
    // Validate minimum wager
    const wagerAmountNum = parseFloat(wagerAmount);
    if (isNaN(wagerAmountNum) || wagerAmountNum < 1) {
      showToast({ 
        type: 'error', 
        title: 'Invalid wager', 
        message: 'Minimum wager is 1 USDC' 
      });
      return;
    }
    
    setSubmitting(true);

    try {
      // Step 1: Request membership signature
      console.log('[PlaceWager] Requesting membership signature...');
      showToast({ 
        type: 'success', 
        title: 'Verifying membership...', 
        message: 'Checking group access' 
      });
      
      const proof = await requestMembershipSignature(bet.groupId, wallet.address);
      console.log('[PlaceWager] Signature received, expires at:', new Date(proof.expiresAt).toLocaleTimeString());
      
      // Step 2: Place wager with signature
      console.log('[PlaceWager] Placing wager with signature...');
      const amount = Math.floor(parseFloat(wagerAmount) * 1_000_000);
      const result = await placeWager(
        betId,
        selectedOutcome,
        amount,
        proof.signature,
        proof.expiresAt
      );
      
      showToast({
        type: 'success',
        title: 'Wager placed!',
        message: `${wagerAmount} USDC on ${bet?.outcomes[selectedOutcome].label}`,
        txHash: result.hash,
      });
      
      // Reload bet data
      const betData = await getBetData(betId);
      setBet(betData);
      if (wallet?.address) {
        const wager = await getUserWager(betId, wallet.address);
        setUserWager(wager);
      }
      
      setWagerAmount('');
      setSelectedOutcome(null);
    } catch (err) {
      console.error('[PlaceWager] Error:', err);
      
      const message = err instanceof Error ? err.message : 'Failed to place wager';
      
      if (message.includes('Not a member') || message.includes('403')) {
        showToast({ 
          type: 'error', 
          title: 'Not a member', 
          message: 'You need to join this group first' 
        });
      } else if (message.includes('expired')) {
        showToast({ 
          type: 'error', 
          title: 'Signature expired', 
          message: 'Please try again' 
        });
      } else {
        showToast({ type: 'error', title: 'Transaction failed', message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveBet = async (winningIndex: number) => {
    setSubmitting(true);

    try {
      const result = await resolveBet(betId, winningIndex);
      
      showToast({
        type: 'success',
        title: 'Bet resolved!',
        message: `Winner: ${bet?.outcomes[winningIndex].label}`,
        txHash: result.hash,
      });
      
      // Reload bet data
      const betData = await getBetData(betId);
      setBet(betData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve bet';
      showToast({ type: 'error', title: 'Transaction failed', message });
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = wallet?.address && bet?.admin === wallet.address;
  const formatUSDC = (amount: number) => (amount / 1_000_000).toFixed(2);

  // Calculate potential payout for a wager amount on an outcome
  const calculatePotentialPayout = (outcomeIndex: number, wagerAmountUSDC: number) => {
    if (!bet || bet.totalPool === 0) return 0;
    const wagerAmount = wagerAmountUSDC * 1_000_000;
    const outcomePool = bet.outcomes[outcomeIndex].pool;
    const newOutcomePool = outcomePool + wagerAmount;
    const newTotalPool = bet.totalPool + wagerAmount;
    return (wagerAmount / newOutcomePool) * newTotalPool;
  };

  // Removed authentication gate - allow viewing bets without login

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content lg:p-0 lg:pt-12 lg:pb-16">
        <div className="p-4 sm:p-6 pt-8 pb-12 lg:p-8">
          <div className="max-w-6xl mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Home</span>
          </Link>

          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="brutalist-spinner-instant mx-auto mb-4">
                </div>
                <p className="text-accent font-mono text-sm">Loading bet from blockchain...</p>
              </CardContent>
            </Card>
          ) : !bet ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-accent text-3xl">error</span>
                </div>
                <h3 className="text-text text-xl font-display font-bold mb-2">Bet Not Found</h3>
                <p className="text-accent text-sm font-mono">
                  This bet doesn&apos;t exist or couldn&apos;t be loaded.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column - Bet Info & Place Bet */}
              <div className="space-y-6">
                {/* Bet Header */}
                <Card>
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 border-2 border-text flex items-center justify-center flex-shrink-0 ${bet.resolved ? 'bg-green-600' : 'bg-primary'}`}>
                        <span className="material-symbols-outlined text-text text-xl sm:text-2xl">
                          {bet.resolved ? 'check_circle' : 'casino'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h1 className="text-text text-base sm:text-lg lg:text-xl font-display font-bold break-words">
                          {bet.description || `Bet #${betId}`}
                        </h1>
                        <p className={`text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider ${bet.resolved ? 'text-green-600' : 'text-primary'}`}>
                          {bet.resolved ? 'Settled' : 'Active'} · #{betId}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <span className={`px-1.5 sm:px-2 py-1 border text-[9px] sm:text-xs font-mono font-bold uppercase flex-shrink-0 ${
                        bet.resolved 
                          ? 'bg-green-600/20 border-green-600 text-green-600' 
                          : 'bg-secondary/20 border-secondary text-secondary'
                      }`}>
                        {bet.resolved ? 'Settled' : 'Admin'}
                      </span>
                    )}
                  </div>

                  <div className="p-3 sm:p-4 bg-background border-2 border-text">
                    <div className="flex justify-between items-center">
                      <span className="text-accent font-mono text-xs sm:text-sm">Total Pool</span>
                      <span className="text-text font-mono font-bold text-base sm:text-lg">{formatUSDC(bet.totalPool)} USDC</span>
                    </div>
                    {userWager > 0 && (
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-text/20">
                        <span className="text-accent font-mono text-xs sm:text-sm">Your Wager</span>
                        <span className="text-primary font-mono font-bold text-sm sm:text-base">{formatUSDC(userWager)} USDC</span>
                      </div>
                    )}
                    {bet.resolved && (
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-text/20">
                        <span className="text-accent font-mono text-xs sm:text-sm">Winner</span>
                        <span className="text-green-600 font-mono font-bold text-sm sm:text-base flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">emoji_events</span>
                          {bet.outcomes[bet.winningOutcomeIndex].label}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Outcomes / Results */}
              <Card>
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <h2 className="text-text text-base sm:text-lg font-display font-bold mb-4">
                    {bet.resolved ? 'Final Results' : 'Place Your Bet'}
                  </h2>

                  <div className="space-y-2 sm:space-y-3">
                    {bet.outcomes.map((outcome, index) => {
                      const hasPool = bet.totalPool >= 10000;
                      const percentage = hasPool ? (outcome.pool / bet.totalPool) * 100 : 0;
                      const isWinner = bet.resolved && bet.winningOutcomeIndex === index;
                      const isLoser = bet.resolved && bet.winningOutcomeIndex !== index;
                      const isSelected = selectedOutcome === index;

                      return (
                        <div
                          key={index}
                          onClick={() => !bet.resolved && setSelectedOutcome(index)}
                          className={`
                            relative p-3 sm:p-4 border-2 transition-all overflow-hidden
                            ${isWinner ? 'border-green-600 bg-green-600/10' : ''}
                            ${isLoser ? 'border-text/30 bg-background opacity-60' : ''}
                            ${!bet.resolved && !isWinner && !isLoser ? 'border-text' : ''}
                            ${!bet.resolved ? 'cursor-pointer hover:bg-primary/10' : ''}
                            ${isSelected ? 'bg-primary/20 border-primary' : ''}
                            ${!isWinner && !isLoser && !isSelected ? 'bg-background' : ''}
                          `}
                        >
                          {/* Progress bar background */}
                          {hasPool && (
                            <div 
                              className={`absolute inset-y-0 left-0 ${isWinner ? 'bg-green-600/20' : 'bg-primary/10'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          )}
                          
                          <div className="relative flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              {!bet.resolved && (
                                <div className={`w-4 h-4 sm:w-5 sm:h-5 border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-text'}`}>
                                  {isSelected && <span className="material-symbols-outlined text-text text-xs sm:text-sm">check</span>}
                                </div>
                              )}
                              {isWinner && (
                                <span className="material-symbols-outlined text-green-600 text-lg sm:text-xl flex-shrink-0">emoji_events</span>
                              )}
                              {isLoser && (
                                <span className="material-symbols-outlined text-accent/50 text-lg sm:text-xl flex-shrink-0">close</span>
                              )}
                              <span className={`font-mono font-bold text-sm sm:text-base truncate ${isLoser ? 'text-accent/50' : 'text-text'}`}>
                                {outcome.label}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`font-mono font-bold text-sm sm:text-base ${isLoser ? 'text-accent/50' : 'text-text'}`}>
                                {formatUSDC(outcome.pool)} USDC
                              </p>
                              {hasPool && (
                                <p className="text-accent font-mono text-[10px] sm:text-xs">{percentage.toFixed(1)}%</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Wager Input - Only show if not resolved */}
                  {!bet.resolved && (
                    <div className="mt-6 pt-6 border-t-2 border-text">
                      <label className="text-text font-mono font-bold text-sm uppercase tracking-wider block mb-3">
                        Your Initial Wager
                      </label>
                      
                      {/* Mobile: Stack vertically, Desktop: Side by side */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Outcome Selector */}
                        <div className="flex-1">
                          <label className="text-accent font-mono text-xs uppercase tracking-wider block mb-2">
                            Select Outcome
                          </label>
                          <select
                            value={selectedOutcome ?? ''}
                            onChange={(e) => setSelectedOutcome(e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full h-12 border-2 border-text bg-surface text-text px-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%23211408' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.75rem center',
                              backgroundSize: '1.25rem'
                            }}
                          >
                            <option value="">Choose outcome...</option>
                            {bet.outcomes.map((outcome, idx) => (
                              <option key={idx} value={idx}>
                                {outcome.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Amount Input */}
                        <div className="flex-1">
                          <label className="text-accent font-mono text-xs uppercase tracking-wider block mb-2">
                            Amount (USDC)
                          </label>
                          <input
                            type="number"
                            value={wagerAmount}
                            onChange={(e) => setWagerAmount(e.target.value)}
                            placeholder="1.00"
                            step="0.01"
                            min="1"
                            className="w-full h-12 border-2 border-text bg-surface text-text placeholder:text-accent/60 px-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        {/* Place Bet Button - Full width on mobile, fixed width on desktop */}
                        <div className="sm:flex sm:items-end">
                          <Button
                            onClick={handlePlaceWager}
                            disabled={selectedOutcome === null || !wagerAmount || submitting}
                            loading={submitting}
                            className="w-full sm:w-auto h-12 whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-base">casino</span>
                            Place Bet
                          </Button>
                        </div>
                      </div>
                      
                      {/* Preview - Show when both fields filled */}
                      {selectedOutcome !== null && wagerAmount && (
                        <div className="mt-3 p-3 sm:p-4 bg-primary/10 border border-primary">
                          <p className="text-accent text-xs sm:text-sm font-mono">
                            Betting <span className="text-text font-bold">{wagerAmount} USDC</span> on{' '}
                            <span className="text-text font-bold">{bet.outcomes[selectedOutcome].label}</span>
                          </p>
                          <p className="text-accent text-xs sm:text-sm font-mono mt-1">
                            Potential payout: <span className="text-green-600 font-bold">
                              {formatUSDC(calculatePotentialPayout(selectedOutcome, parseFloat(wagerAmount) || 0))} USDC
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>

              {/* Right Column - Pool Info, Admin & Summary */}
              <div className="space-y-4 sm:space-y-6">
              {/* Bettors Section */}
              <Card>
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <h2 className="text-text text-base sm:text-lg font-display font-bold mb-4">
                    {bet.resolved ? 'Betting Activity' : 'Who\'s Betting'}
                  </h2>

                  {bet.totalPool === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-text/20">
                      <span className="material-symbols-outlined text-accent/50 text-3xl sm:text-4xl mb-2">how_to_vote</span>
                      <p className="text-accent text-xs sm:text-sm font-mono">No bets placed yet</p>
                      <p className="text-accent/60 text-[10px] sm:text-xs font-mono mt-1">Be the first to wager!</p>
                    </div>
                  ) : (
                    <>
                      {/* Pool breakdown by outcome */}
                      <div className="mb-4">
                        <p className="text-accent text-[10px] sm:text-xs font-mono uppercase tracking-wider mb-2">Wagers by Outcome</p>
                        <div className="space-y-2">
                          {bet.outcomes.map((outcome, index) => {
                            const isWinner = bet.resolved && bet.winningOutcomeIndex === index;
                            const percentage = bet.totalPool > 0 ? (outcome.pool / bet.totalPool) * 100 : 0;
                            // Count bettors for this outcome
                            const outcomeBettors = bettors.filter(b => b.outcomeIndex === index);
                            
                            return (
                              <div 
                                key={index}
                                className={`p-2 sm:p-3 border-2 ${
                                  isWinner ? 'border-green-600 bg-green-600/10' : 'border-text/20 bg-background'
                                }`}
                              >
                                <div className="flex justify-between items-center gap-2">
                                  <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                                    {isWinner && (
                                      <span className="material-symbols-outlined text-green-600 text-base sm:text-lg flex-shrink-0">emoji_events</span>
                                    )}
                                    <span className={`font-mono font-bold text-xs sm:text-sm truncate ${isWinner ? 'text-green-600' : 'text-text'}`}>
                                      {outcome.label}
                                    </span>
                                    {outcomeBettors.length > 0 && (
                                      <span className="text-accent text-[10px] sm:text-xs font-mono flex-shrink-0">
                                        ({outcomeBettors.length})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className="text-text font-mono font-bold text-xs sm:text-sm">{formatUSDC(outcome.pool)}</span>
                                    <span className="text-accent font-mono text-[10px] sm:text-xs ml-1 sm:ml-2">({percentage.toFixed(0)}%)</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Your wager info */}
                      {userWager > 0 && (
                        <div className="mb-4 p-3 sm:p-4 bg-primary/10 border-2 border-primary">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-primary text-base sm:text-lg">person</span>
                            <span className="text-text font-mono font-bold text-xs sm:text-sm">Your Wager</span>
                          </div>
                          <p className="text-text font-mono text-sm sm:text-base">{formatUSDC(userWager)} USDC</p>
                          {userOutcomeIndex !== null && bet.outcomes[userOutcomeIndex] && (
                            <p className="text-accent text-[10px] sm:text-xs font-mono mt-1">
                              Betting on: <span className="text-text font-bold">{bet.outcomes[userOutcomeIndex].label}</span>
                              {bet.resolved && (
                                userOutcomeIndex === bet.winningOutcomeIndex ? (
                                  <span className="text-green-600 ml-2">🎉 You won!</span>
                                ) : (
                                  <span className="text-accent/50 ml-2">Better luck next time</span>
                                )
                              )}
                            </p>
                          )}
                          {bet.resolved && userOutcomeIndex === bet.winningOutcomeIndex && (
                            <p className="text-green-600 text-xs sm:text-sm font-mono font-bold mt-2">
                              Payout: {formatUSDC((userWager / bet.outcomes[bet.winningOutcomeIndex].pool) * bet.totalPool)} USDC
                            </p>
                          )}
                        </div>
                      )}

                      {/* Individual bettors */}
                      {bettors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-accent text-[10px] sm:text-xs font-mono uppercase tracking-wider mb-2">
                            All Bettors ({bettors.length})
                          </p>
                          {bettors.map((bettor, index) => {
                            const avatar = bettor.avatarId !== undefined ? getAvatarById(bettor.avatarId) : null;
                            const avatarUrl = avatar ? getAvatarUrl(avatar.seed, avatar.style) : null;
                            const isYou = wallet?.address === bettor.address;
                            const isWinner = bet.resolved && bettor.outcomeIndex === bet.winningOutcomeIndex;
                            const outcomeLabel = bet.outcomes[bettor.outcomeIndex]?.label || 'Unknown';
                            
                            // Calculate potential/actual payout
                            const payout = bet.resolved && isWinner && bet.outcomes[bet.winningOutcomeIndex].pool > 0
                              ? (bettor.amount / bet.outcomes[bet.winningOutcomeIndex].pool) * bet.totalPool
                              : 0;
                            
                            return (
                              <div
                                key={index}
                                className={`p-2 sm:p-3 border-2 ${
                                  bet.resolved 
                                    ? isWinner 
                                      ? 'border-green-600 bg-green-600/10' 
                                      : 'border-text/20 bg-background opacity-60'
                                    : 'border-text/20 bg-background'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {avatarUrl ? (
                                      <img 
                                        src={avatarUrl} 
                                        alt={bettor.name || 'Bettor'} 
                                        className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-text flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-text bg-surface flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-text text-xs sm:text-sm">person</span>
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-text font-mono font-bold text-xs sm:text-sm flex items-center gap-1 truncate">
                                        {bettor.name || `${bettor.address.slice(0, 6)}...${bettor.address.slice(-4)}`}
                                        {isYou && (
                                          <span className="text-[8px] sm:text-[10px] bg-primary text-text px-1 sm:px-2 py-0.5 uppercase tracking-wider flex-shrink-0">You</span>
                                        )}
                                      </p>
                                      <p className="text-accent text-[10px] sm:text-xs font-mono truncate">
                                        {formatUSDC(bettor.amount)} on <span className="text-text">{outcomeLabel}</span>
                                      </p>
                                    </div>
                                  </div>
                                  {bet.resolved && (
                                    <div className="text-right flex-shrink-0">
                                      {isWinner ? (
                                        <>
                                          <p className="text-green-600 font-mono font-bold text-xs sm:text-sm flex items-center gap-0.5 justify-end">
                                            <span className="material-symbols-outlined text-xs sm:text-sm">emoji_events</span>
                                            WON
                                          </p>
                                          <p className="text-green-600 text-[10px] sm:text-xs font-mono">
                                            +{formatUSDC(payout)}
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-accent/50 font-mono font-bold text-xs sm:text-sm">LOST</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Admin Controls */}
              {isAdmin && !bet.resolved && (
                <Card>
                  <CardContent className="p-4 sm:p-5 lg:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-secondary text-lg sm:text-xl">admin_panel_settings</span>
                      <h2 className="text-text text-base sm:text-lg font-display font-bold">Admin: Resolve Bet</h2>
                    </div>
                    <p className="text-accent text-xs sm:text-sm font-mono mb-4">
                      Select the winning outcome to settle this bet and pay out winners.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {bet.outcomes.map((outcome, index) => (
                        <Button
                          key={index}
                          variant="secondary"
                          onClick={() => handleResolveBet(index)}
                          disabled={submitting}
                          className="justify-center text-sm h-11 sm:h-12"
                        >
                          <span className="material-symbols-outlined text-base">emoji_events</span>
                          {outcome.label} Wins
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resolved Summary */}
              {bet.resolved && (
                <Card>
                  <CardContent className="p-4 sm:p-5 lg:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-green-600 text-lg sm:text-xl">verified</span>
                      <h2 className="text-text text-base sm:text-lg font-display font-bold">Settlement Summary</h2>
                    </div>
                    
                    {(() => {
                      const winningPool = bet.outcomes[bet.winningOutcomeIndex].pool;
                      const payoutMultiplier = winningPool > 0 ? bet.totalPool / winningPool : 0;
                      const winners = bettors.filter(b => b.outcomeIndex === bet.winningOutcomeIndex);
                      const losers = bettors.filter(b => b.outcomeIndex !== bet.winningOutcomeIndex);
                      
                      return (
                        <div className="space-y-3">
                          {/* Big winner display */}
                          <div className="p-3 sm:p-4 bg-green-600/10 border-2 border-green-600 text-center">
                            <span className="material-symbols-outlined text-green-600 text-3xl sm:text-4xl mb-2">emoji_events</span>
                            <p className="text-green-600 font-display font-bold text-xl sm:text-2xl mb-1">
                              {bet.outcomes[bet.winningOutcomeIndex].label}
                            </p>
                            <p className="text-accent font-mono text-xs sm:text-sm">Winning Outcome</p>
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div className="p-2 sm:p-3 bg-background border-2 border-text">
                              <p className="text-accent font-mono text-[10px] sm:text-xs uppercase tracking-wider mb-1">Winning Pool</p>
                              <p className="text-text font-mono font-bold text-sm sm:text-base">{formatUSDC(winningPool)}</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-background border-2 border-text">
                              <p className="text-accent font-mono text-[10px] sm:text-xs uppercase tracking-wider mb-1">Total Pool</p>
                              <p className="text-text font-mono font-bold text-sm sm:text-base">{formatUSDC(bet.totalPool)}</p>
                            </div>
                          </div>

                          {/* Payout multiplier */}
                          <div className="p-3 bg-primary/10 border-2 border-primary">
                            <div className="flex justify-between items-center">
                              <span className="text-accent font-mono text-xs sm:text-sm">Payout Multiplier</span>
                              <span className="text-primary font-mono font-bold text-base sm:text-lg">{payoutMultiplier.toFixed(2)}x</span>
                            </div>
                            <p className="text-accent/70 font-mono text-[10px] sm:text-xs mt-1">
                              Winners received {payoutMultiplier.toFixed(2)}x their wager
                            </p>
                          </div>

                          {/* Winner/Loser counts from indexer */}
                          {bettors.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div className="p-2 sm:p-3 bg-green-600/10 border-2 border-green-600">
                                <p className="text-green-600 font-mono text-[10px] sm:text-xs uppercase tracking-wider mb-1">Winners</p>
                                <p className="text-green-600 font-mono font-bold text-base sm:text-lg">{winners.length}</p>
                              </div>
                              <div className="p-2 sm:p-3 bg-background border-2 border-text/30">
                                <p className="text-accent font-mono text-[10px] sm:text-xs uppercase tracking-wider mb-1">Losers</p>
                                <p className="text-accent font-mono font-bold text-base sm:text-lg">{losers.length}</p>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
              </div>
            </div>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
