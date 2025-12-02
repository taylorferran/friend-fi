'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent } from '@/components/ui/Card';

// Mock leaderboard data
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
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=7311d4,E42575,10B981&backgroundType=gradientLinear`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('all');

  // Redirect to login if not authenticated
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
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-300';
      case 3: return 'text-amber-600';
      default: return 'text-white/60';
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-white text-3xl lg:text-4xl font-black tracking-tight mb-2">Leaderboard</h1>
            <p className="text-white/60">See who&apos;s winning the most in your group.</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-[#7311d4] text-3xl mb-2">emoji_events</span>
                <p className="text-white text-2xl font-bold">7</p>
                <p className="text-white/50 text-sm">Your Rank</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-[#10B981] text-3xl mb-2">payments</span>
                <p className="text-white text-2xl font-bold">320 USDC</p>
                <p className="text-white/50 text-sm">Total Winnings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-[#E42575] text-3xl mb-2">percent</span>
                <p className="text-white text-2xl font-bold">60%</p>
                <p className="text-white/50 text-sm">Win Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-yellow-400 text-3xl mb-2">casino</span>
                <p className="text-white text-2xl font-bold">5</p>
                <p className="text-white/50 text-sm">Total Bets</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeframe Filter */}
          <div className="flex gap-2 mb-6">
            {(['week', 'month', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-[#7311d4] text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tf === 'week' ? 'This Week' : tf === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>

          {/* Leaderboard Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/50 text-xs uppercase tracking-wider font-medium p-4">Rank</th>
                      <th className="text-left text-white/50 text-xs uppercase tracking-wider font-medium p-4">User</th>
                      <th className="text-right text-white/50 text-xs uppercase tracking-wider font-medium p-4">Winnings</th>
                      <th className="text-right text-white/50 text-xs uppercase tracking-wider font-medium p-4 hidden sm:table-cell">Bets</th>
                      <th className="text-right text-white/50 text-xs uppercase tracking-wider font-medium p-4 hidden sm:table-cell">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockLeaderboard.map((entry) => (
                      <tr 
                        key={entry.rank}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                          entry.isYou ? 'bg-[#7311d4]/10' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getRankIcon(entry.rank) ? (
                              <span className="text-xl">{getRankIcon(entry.rank)}</span>
                            ) : (
                              <span className={`font-bold ${getRankColor(entry.rank)}`}>#{entry.rank}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={getAvatarUrl(entry.avatar)} 
                              alt={entry.user}
                              className="w-10 h-10 rounded-full ring-2 ring-white/10"
                            />
                            <span className={`font-medium ${entry.isYou ? 'text-[#7311d4]' : 'text-white'}`}>
                              {entry.user}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-[#10B981] font-bold">{entry.winnings.toLocaleString()}</span>
                          <span className="text-white/50 text-sm ml-1">USDC</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className="text-white">{entry.bets}</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className={`font-medium ${
                            entry.winRate >= 60 ? 'text-[#10B981]' : 
                            entry.winRate >= 50 ? 'text-yellow-400' : 'text-[#E42575]'
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
