'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getGroupsCount, getGroupMembers, checkIfMemberInGroup, getProfiles } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
import { getWagersForUser, getPayoutsForUser } from '@/lib/indexer';

interface LeaderboardEntry {
  address: string;
  name?: string;
  avatarId?: number;
  totalWagered: number;
  totalWon: number;
  profitLoss: number;
  wins: number;
  totalBets: number;
  winrate: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const { wallet } = useMoveWallet();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    async function loadLeaderboard() {
      if (!wallet?.address) return;

      try {
        const groupCount = await getGroupsCount();
        const uniqueMembers = new Set<string>();

        // Find all groups user is in and collect unique members
        for (let i = 0; i < groupCount; i++) {
          try {
            const isMember = await checkIfMemberInGroup(i, wallet.address);
            if (isMember) {
              const members = await getGroupMembers(i);
              members.forEach(member => uniqueMembers.add(member));
            }
          } catch (error) {
            console.error(`Error checking group ${i}:`, error);
          }
        }

        // Get profiles and stats for all unique members IN PARALLEL
        const memberArray = Array.from(uniqueMembers);
        const [profiles, ...statsResults] = await Promise.all([
          getProfiles(memberArray),
          ...memberArray.map(async (address) => {
            const [wagers, payouts] = await Promise.all([
              getWagersForUser(address),
              getPayoutsForUser(address),
            ]);

            const totalWagered = wagers.reduce((sum, w) => sum + w.amount, 0);
            const totalWon = payouts.reduce((sum, p) => sum + p.amount, 0);
            const profitLoss = totalWon - totalWagered;
            const wins = payouts.length;
            const totalBets = wagers.length;
            const winrate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

            return {
              address,
              totalWagered,
              totalWon,
              profitLoss,
              wins,
              totalBets,
              winrate,
            };
          }),
        ]);

        // Create leaderboard entries sorted by P&L
        const leaderboardEntries: LeaderboardEntry[] = statsResults
          .map((stats, idx) => ({
            ...stats,
            name: profiles.get(stats.address)?.name,
            avatarId: profiles.get(stats.address)?.avatarId,
          }))
          .sort((a, b) => b.profitLoss - a.profitLoss);

        setEntries(leaderboardEntries);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, [wallet?.address]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner-instant">
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 sm:p-6 pt-8 pb-12 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Leaderboard</h1>
            <p className="text-accent font-mono text-sm sm:text-base">Friends across your groups</p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="brutalist-spinner-instant mx-auto mb-4">
                  <div className="brutalist-spinner-box-instant"></div>
                  <div className="brutalist-spinner-box-instant"></div>
                  <div className="brutalist-spinner-box-instant"></div>
                  <div className="brutalist-spinner-box-instant"></div>
                </div>
                <p className="text-accent font-mono text-sm">Loading leaderboard...</p>
              </CardContent>
            </Card>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-accent text-3xl">leaderboard</span>
                </div>
                <h3 className="text-text text-xl font-display font-bold mb-2">No Leaderboard Data</h3>
                <p className="text-accent text-sm font-mono">
                  Join some groups to see the leaderboard!
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {/* Header */}
                <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] gap-2 sm:gap-4 px-3 sm:px-4 py-3 border-b-2 border-text bg-background">
                  <span className="text-accent font-mono text-xs uppercase tracking-wider w-6 sm:w-8">#</span>
                  <span className="text-accent font-mono text-xs uppercase tracking-wider">Player</span>
                  <span className="text-accent font-mono text-xs uppercase tracking-wider text-right hidden sm:inline">P&L</span>
                  <span className="text-accent font-mono text-xs uppercase tracking-wider text-right hidden sm:inline">Winrate</span>
                </div>

                {/* Entries */}
                <div>
                  {entries.map((entry, index) => {
                    const isYou = wallet?.address === entry.address;
                    const avatar = entry.avatarId !== undefined ? getAvatarById(entry.avatarId) : null;
                    const avatarUrl = avatar ? getAvatarUrl(avatar.seed, avatar.style) : null;
                    const rank = index + 1;
                    const plColor = entry.profitLoss > 0 ? 'text-green-600' : entry.profitLoss < 0 ? 'text-secondary' : 'text-accent';
                    
                    return (
                      <div
                        key={entry.address}
                        className={`grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] gap-2 sm:gap-4 items-center px-3 sm:px-4 py-3 sm:py-4 border-b border-text/20 ${
                          isYou ? 'bg-primary/10' : ''
                        } ${rank <= 3 ? 'bg-primary/5' : ''}`}
                      >
                        {/* Rank */}
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-mono font-bold ${
                          rank === 1 ? 'text-primary text-base sm:text-lg' :
                          rank === 2 ? 'text-accent text-base sm:text-lg' :
                          rank === 3 ? 'text-secondary text-base sm:text-lg' :
                          'text-accent/60 text-xs sm:text-sm'
                        }`}>
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                        </div>

                        {/* Avatar & Name */}
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          {avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt={entry.name || 'Player'} 
                              className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-text flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-text bg-surface flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-text text-sm sm:text-base">person</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-text font-mono font-bold text-xs sm:text-sm flex items-center gap-1 sm:gap-2 truncate">
                              <span className="truncate">{entry.name || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}</span>
                              {isYou && (
                                <span className="text-[9px] sm:text-[10px] bg-primary text-text px-1.5 sm:px-2 py-0.5 uppercase tracking-wider flex-shrink-0">You</span>
                              )}
                            </p>
                            <p className="text-accent text-xs font-mono">
                              {entry.totalBets} bet{entry.totalBets !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {/* P&L - Mobile: Combined with winrate */}
                        <div className="text-right sm:text-right">
                          <p className={`font-mono font-bold text-xs sm:text-sm ${plColor}`}>
                            ${(entry.profitLoss / 1_000_000).toFixed(2)}
                          </p>
                          <p className="text-accent text-[10px] sm:text-xs font-mono sm:hidden">
                            {entry.winrate.toFixed(0)}% • {entry.wins}W
                          </p>
                        </div>

                        {/* Winrate - Desktop only */}
                        <div className="text-right min-w-[60px] hidden sm:block">
                          <p className="text-text font-mono font-bold text-sm">
                            {entry.winrate.toFixed(0)}%
                          </p>
                          <p className="text-accent text-xs font-mono">
                            {entry.wins}W
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Note */}
          <div className="mt-6 p-4 bg-surface border-2 border-text">
            <p className="text-accent text-xs font-mono">
              <span className="text-text font-bold">Note:</span> Leaderboard shows all friends across your groups, sorted by profit & loss.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
