'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getGroupsCount, getGroupMembers, checkIfMemberInGroup, getProfiles } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';

interface LeaderboardEntry {
  address: string;
  name?: string;
  avatarId?: number;
  groupCount: number;
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
        const memberCounts = new Map<string, number>();
        const userGroups: number[] = [];

        // Find all groups user is in and collect unique members
        for (let i = 0; i < groupCount; i++) {
          try {
            const isMember = await checkIfMemberInGroup(i, wallet.address);
            if (isMember) {
              userGroups.push(i);
              const members = await getGroupMembers(i);
              members.forEach(member => {
                memberCounts.set(member, (memberCounts.get(member) || 0) + 1);
              });
            }
          } catch (error) {
            console.error(`Error checking group ${i}:`, error);
          }
        }

        // Get profiles for all unique members
        const uniqueMembers = Array.from(memberCounts.keys());
        const profiles = await getProfiles(uniqueMembers);

        // Create leaderboard entries sorted by group count
        const leaderboardEntries: LeaderboardEntry[] = uniqueMembers
          .map(address => ({
            address,
            name: profiles.get(address)?.name,
            avatarId: profiles.get(address)?.avatarId,
            groupCount: memberCounts.get(address) || 0,
          }))
          .sort((a, b) => b.groupCount - a.groupCount);

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

      <main className="flex-1 mobile-content p-4 pt-8 pb-12 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Leaderboard</h1>
            <p className="text-accent font-mono">Friends across your groups</p>
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
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-text bg-background">
                  <div className="flex items-center gap-4">
                    <span className="text-accent font-mono text-xs uppercase tracking-wider w-8">#</span>
                    <span className="text-accent font-mono text-xs uppercase tracking-wider">Player</span>
                  </div>
                  <span className="text-accent font-mono text-xs uppercase tracking-wider">Groups</span>
                </div>

                {/* Entries */}
                <div>
                  {entries.map((entry, index) => {
                    const isYou = wallet?.address === entry.address;
                    const avatar = entry.avatarId !== undefined ? getAvatarById(entry.avatarId) : null;
                    const avatarUrl = avatar ? getAvatarUrl(avatar.seed, avatar.style) : null;
                    const rank = index + 1;
                    
                    return (
                      <div
                        key={entry.address}
                        className={`flex items-center justify-between px-4 py-4 border-b border-text/20 ${
                          isYou ? 'bg-primary/10' : ''
                        } ${rank <= 3 ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Rank */}
                          <div className={`w-8 h-8 flex items-center justify-center font-mono font-bold ${
                            rank === 1 ? 'text-primary text-lg' :
                            rank === 2 ? 'text-accent text-lg' :
                            rank === 3 ? 'text-secondary text-lg' :
                            'text-accent/60 text-sm'
                          }`}>
                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                          </div>

                          {/* Avatar & Name */}
                          <div className="flex items-center gap-3">
                            {avatarUrl ? (
                              <img 
                                src={avatarUrl} 
                                alt={entry.name || 'Player'} 
                                className="w-10 h-10 border-2 border-text"
                              />
                            ) : (
                              <div className="w-10 h-10 border-2 border-text bg-surface flex items-center justify-center">
                                <span className="material-symbols-outlined text-text">person</span>
                              </div>
                            )}
                            <div>
                              <p className="text-text font-mono font-bold text-sm flex items-center gap-2">
                                {entry.name || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
                                {isYou && (
                                  <span className="text-[10px] bg-primary text-text px-2 py-0.5 uppercase tracking-wider">You</span>
                                )}
                              </p>
                              <p className="text-accent text-xs font-mono">
                                {entry.address.slice(0, 10)}...{entry.address.slice(-6)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="text-right">
                          <p className="text-text font-mono font-bold">{entry.groupCount}</p>
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
              <span className="text-text font-bold">Note:</span> This leaderboard currently shows friends across your groups. 
              Win/loss tracking and detailed stats coming soon!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
