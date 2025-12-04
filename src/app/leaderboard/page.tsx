'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent } from '@/components/ui/Card';

const mockLeaderboard = [
  { rank: 1, user: 'Michael', avatar: 'felix', winnings: 2450, bets: 15, winRate: 73 },
  { rank: 2, user: 'Sarah', avatar: 'luna', winnings: 1820, bets: 12, winRate: 67 },
  { rank: 3, user: 'David', avatar: 'max', winnings: 1340, bets: 18, winRate: 61 },
  { rank: 4, user: 'Emma', avatar: 'bella', winnings: 980, bets: 8, winRate: 75 },
  { rank: 5, user: 'James', avatar: 'charlie', winnings: 720, bets: 10, winRate: 50 },
  { rank: 6, user: 'Lisa', avatar: 'mia', winnings: 450, bets: 6, winRate: 50 },
  { rank: 7, user: 'You', avatar: 'leo', winnings: 320, bets: 5, winRate: 60, isYou: true },
];

function getAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('all');

  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-600';
      case 2: return 'text-gray-500';
      case 3: return 'text-amber-700';
      default: return 'text-accent';
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 pt-8 pb-8 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Leaderboard</h1>
            <p className="text-accent font-mono">See who&apos;s winning the most in your group.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-primary text-3xl mb-2">emoji_events</span>
                <p className="text-text text-2xl font-display font-bold">7</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Your Rank</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-green-600 text-3xl mb-2">payments</span>
                <p className="text-text text-2xl font-display font-bold">320 USDC</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Total Winnings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-secondary text-3xl mb-2">percent</span>
                <p className="text-text text-2xl font-display font-bold">60%</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Win Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-primary text-3xl mb-2">casino</span>
                <p className="text-text text-2xl font-display font-bold">5</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Total Bets</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 mb-6">
            {(['week', 'month', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 text-sm font-mono font-bold uppercase tracking-wider transition-colors border-2 ${
                  timeframe === tf
                    ? 'bg-primary border-text text-text'
                    : 'bg-surface border-text text-text hover:bg-primary/20'
                }`}
              >
                {tf === 'week' ? 'This Week' : tf === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-text">
                      <th className="text-left text-accent text-xs font-mono uppercase tracking-wider font-bold p-4">Rank</th>
                      <th className="text-left text-accent text-xs font-mono uppercase tracking-wider font-bold p-4">User</th>
                      <th className="text-right text-accent text-xs font-mono uppercase tracking-wider font-bold p-4">Winnings</th>
                      <th className="text-right text-accent text-xs font-mono uppercase tracking-wider font-bold p-4 hidden sm:table-cell">Bets</th>
                      <th className="text-right text-accent text-xs font-mono uppercase tracking-wider font-bold p-4 hidden sm:table-cell">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockLeaderboard.map((entry) => (
                      <tr 
                        key={entry.rank}
                        className={`border-b-2 border-text/20 hover:bg-primary/10 transition-colors ${
                          entry.isYou ? 'bg-primary/20' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getRankIcon(entry.rank) ? (
                              <span className="text-xl">{getRankIcon(entry.rank)}</span>
                            ) : (
                              <span className={`font-mono font-bold ${getRankColor(entry.rank)}`}>#{entry.rank}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={getAvatarUrl(entry.avatar)} 
                              alt={entry.user}
                              className="w-10 h-10 border-2 border-text"
                            />
                            <span className={`font-mono font-bold ${entry.isYou ? 'text-primary' : 'text-text'}`}>
                              {entry.user}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-green-600 font-display font-bold">{entry.winnings.toLocaleString()}</span>
                          <span className="text-accent text-sm font-mono ml-1">USDC</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className="text-text font-mono">{entry.bets}</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className={`font-mono font-bold ${
                            entry.winRate >= 60 ? 'text-green-600' : 
                            entry.winRate >= 50 ? 'text-primary' : 'text-secondary'
                          }`}>
                            {entry.winRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
