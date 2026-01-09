'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getGroupMembers, getGroupBets, getGroupName, getBetDescription, getProfiles, getBetData } from '@/lib/contract';
import { getCompleteBetInfo } from '@/lib/indexer';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
import { useToast } from '@/components/ui/Toast';
import { transferUSDCFromFaucet } from '@/lib/move-wallet';
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

interface BettorResult {
  address: string;
  name?: string;
  avatarId?: number;
  amount: number;
  outcomeIndex: number;
  isWinner: boolean;
  payout?: number;
}

interface BetInfo {
  id: number;
  description: string;
  resolved?: boolean;
  winningOutcome?: string;
  totalPool?: number;
  participantCount?: number;
  bettors?: BettorResult[];
}

export default function GroupPrivatePredictionsPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated } = useAuth();
  const { wallet } = useMoveWallet();
  const { showToast } = useToast();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [bets, setBets] = useState<BetInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Store group context for bet creation (updates when groupName changes)
  useEffect(() => {
    if (!isNaN(groupId) && groupName) {
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: groupId,
        name: groupName,
      }));
    }
  }, [groupId, groupName]);

  // Load group data - FAST on-chain first, then enhance with indexer
  useEffect(() => {
    async function loadGroupData() {
      if (isNaN(groupId)) {
        setLoading(false);
        return;
      }

      try {
        // Load group name and bets in parallel
        const [name, groupBets] = await Promise.all([
          getGroupName(groupId),
          getGroupBets(groupId),
        ]);

        // Set group name from contract
        setGroupName(name || `Group #${groupId}`);

        // Load bet descriptions and status in parallel
        Promise.all(
          groupBets.map(async (id) => {
            try {
              const [description, betData, betInfo] = await Promise.all([
                getBetDescription(id),
                getBetData(id),
                getCompleteBetInfo(id)
              ]);
              
              // Get profiles for all bettors
              const bettorAddresses = betInfo.wagers.map(w => w.address);
              const profiles = bettorAddresses.length > 0 ? await getProfiles(bettorAddresses) : new Map();
              
              // Map bettors with their profile info
              const bettorsWithProfiles: BettorResult[] = betInfo.wagers.map(wager => ({
                address: wager.address,
                name: profiles.get(wager.address)?.name,
                avatarId: profiles.get(wager.address)?.avatarId,
                amount: wager.amount,
                outcomeIndex: wager.outcomeIndex,
                isWinner: betData.resolved ? wager.outcomeIndex === betData.winningOutcomeIndex : false,
                payout: wager.payout
              }));
              
              return { 
                id, 
                description,
                resolved: betData.resolved,
                winningOutcome: betData.resolved ? betData.outcomes[betData.winningOutcomeIndex].label : undefined,
                totalPool: betData.totalPool,
                participantCount: bettorsWithProfiles.length,
                bettors: bettorsWithProfiles
              };
            } catch (error) {
              console.error(`Error loading bet ${id}:`, error);
              return { id, description: `Bet #${id}` };
            }
          })
        ).then(betsWithDetails => {
          setBets(betsWithDetails);
        }).catch(() => {
          // Fallback: bets without descriptions
          setBets(groupBets.map(id => ({ id, description: `Bet #${id}` })));
        });

      } catch (error) {
        console.error('Error loading group data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [groupId]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content lg:p-0 lg:pt-16 lg:pb-16">
        <div className="p-4 sm:p-6 pt-8 pb-12 lg:p-8">
          <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link 
            href={`/groups/${groupId}`}
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Group</span>
          </Link>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto">
                </div>
                <p className="text-accent text-sm font-mono mt-4">Loading group...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Group Header */}
              <Card className="mb-6">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-text text-2xl">casino</span>
                      </div>
                      <div>
                        <h1 className="text-text text-xl lg:text-2xl font-display font-bold">{groupName}</h1>
                        <p className="text-accent text-sm font-mono">
                          Private Predictions · {bets.length} bet{bets.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Link href={`/bets/create?groupId=${groupId}&groupName=${encodeURIComponent(groupName)}`}>
                      <Button>
                        <span className="material-symbols-outlined">add</span>
                        New Bet
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Bets Section */}
              <Card>
                <CardContent>
                  {bets.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-accent text-3xl">casino</span>
                      </div>
                      <h3 className="text-text text-xl font-display font-bold mb-2">No Bets Yet</h3>
                      <p className="text-accent text-sm font-mono mb-6 max-w-sm mx-auto">
                        Create the first prediction for your group to start betting!
                      </p>
                      <Link href={`/bets/create?groupId=${groupId}&groupName=${encodeURIComponent(groupName)}`}>
                        <Button>
                          <span className="material-symbols-outlined">add</span>
                          Create First Bet
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bets.map((bet) => {
                        const winners = bet.bettors?.filter(b => b.isWinner) || [];
                        const losers = bet.bettors?.filter(b => !b.isWinner) || [];
                        
                        return (
                        <Link key={bet.id} href={`/bets/${bet.id}`}>
                          <div className={`p-4 border-2 ${bet.resolved ? 'border-green-600 bg-green-600/5' : 'border-text bg-background'} hover:bg-primary/10 transition-colors cursor-pointer`}>
                            <div className="flex flex-col gap-3">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className={`w-10 h-10 border-2 border-text flex items-center justify-center flex-shrink-0 ${bet.resolved ? 'bg-green-600' : 'bg-primary/20'}`}>
                                    <span className="material-symbols-outlined text-text text-lg">
                                      {bet.resolved ? 'check_circle' : 'casino'}
                                    </span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <p className="text-text font-mono font-bold text-sm sm:text-base truncate">
                                        {bet.description || `Bet #${bet.id}`}
                                      </p>
                                      {bet.resolved && (
                                        <span className="text-[9px] sm:text-[10px] bg-green-600 text-white px-1.5 sm:px-2 py-0.5 uppercase tracking-wider font-bold flex-shrink-0">
                                          Settled
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-1">
                                      <p className="text-accent text-xs font-mono">
                                        Bet #{bet.id} · {bet.participantCount || 0} participant{(bet.participantCount || 0) !== 1 ? 's' : ''}
                                      </p>
                                      
                                      {bet.totalPool !== undefined && bet.totalPool > 0 && (
                                        <p className="text-accent text-xs font-mono">
                                          Pool: ${(bet.totalPool / 1_000_000).toFixed(2)} USDC
                                        </p>
                                      )}
                                      
                                      {bet.resolved && bet.winningOutcome && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <span className="material-symbols-outlined text-green-600 text-sm">emoji_events</span>
                                          <p className="text-green-600 text-xs sm:text-sm font-mono font-bold">
                                            Winner: {bet.winningOutcome}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className="material-symbols-outlined text-accent flex-shrink-0">chevron_right</span>
                              </div>
                              
                              {/* Participants Summary (only show for resolved bets with participants) */}
                              {bet.resolved && bet.bettors && bet.bettors.length > 0 && (
                                <div className="ml-13 pl-3 border-l-2 border-text/20 space-y-2">
                                  {/* Winners */}
                                  {winners.length > 0 && (
                                    <div>
                                      <p className="text-green-600 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider mb-1.5">
                                        Winners ({winners.length})
                                      </p>
                                      <div className="space-y-1">
                                        {winners.map((winner, idx) => {
                                          const avatar = winner.avatarId !== undefined ? getAvatarById(winner.avatarId) : null;
                                          const avatarUrl = avatar ? getAvatarUrl(avatar.seed, avatar.style) : null;
                                          const isYou = wallet?.address === winner.address;
                                          
                                          return (
                                            <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-green-600/10 border border-green-600/30">
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {avatarUrl ? (
                                                  <img 
                                                    src={avatarUrl} 
                                                    alt={winner.name || 'Winner'} 
                                                    className="w-5 h-5 sm:w-6 sm:h-6 border border-text flex-shrink-0"
                                                  />
                                                ) : (
                                                  <div className="w-5 h-5 sm:w-6 sm:h-6 border border-text bg-surface flex items-center justify-center flex-shrink-0">
                                                    <span className="material-symbols-outlined text-text text-xs">person</span>
                                                  </div>
                                                )}
                                                <span className="text-text font-mono text-[10px] sm:text-xs font-bold truncate">
                                                  {winner.name || `${winner.address.slice(0, 6)}...`}
                                                  {isYou && ' (You)'}
                                                </span>
                                              </div>
                                              <span className="text-green-600 font-mono text-[10px] sm:text-xs font-bold flex-shrink-0">
                                                +${((winner.payout || 0) / 1_000_000).toFixed(2)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Losers */}
                                  {losers.length > 0 && (
                                    <div>
                                      <p className="text-accent/70 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider mb-1.5">
                                        Lost ({losers.length})
                                      </p>
                                      <div className="space-y-1">
                                        {losers.map((loser, idx) => {
                                          const avatar = loser.avatarId !== undefined ? getAvatarById(loser.avatarId) : null;
                                          const avatarUrl = avatar ? getAvatarUrl(avatar.seed, avatar.style) : null;
                                          const isYou = wallet?.address === loser.address;
                                          
                                          return (
                                            <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-background border border-text/20 opacity-70">
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {avatarUrl ? (
                                                  <img 
                                                    src={avatarUrl} 
                                                    alt={loser.name || 'Player'} 
                                                    className="w-5 h-5 sm:w-6 sm:h-6 border border-text flex-shrink-0"
                                                  />
                                                ) : (
                                                  <div className="w-5 h-5 sm:w-6 sm:h-6 border border-text bg-surface flex items-center justify-center flex-shrink-0">
                                                    <span className="material-symbols-outlined text-text text-xs">person</span>
                                                  </div>
                                                )}
                                                <span className="text-accent font-mono text-[10px] sm:text-xs font-bold truncate">
                                                  {loser.name || `${loser.address.slice(0, 6)}...`}
                                                  {isYou && ' (You)'}
                                                </span>
                                              </div>
                                              <span className="text-accent/70 font-mono text-[10px] sm:text-xs font-bold flex-shrink-0">
                                                -${(loser.amount / 1_000_000).toFixed(2)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}

