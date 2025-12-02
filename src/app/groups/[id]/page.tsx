'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

// Mock group data
const mockGroup = {
  id: 'crypto-degens',
  name: 'Crypto Degens',
  description: 'Predictions about crypto, markets, and degen plays',
  createdAt: 'Jan 15, 2024',
  totalWagered: 12500,
  activeBets: 3,
  settledBets: 12,
};

// Mock members with P&L
const mockMembers = [
  { id: '1', name: 'Michael', avatar: 'felix', pnl: 2450, bets: 15, winRate: 73, isOnline: true },
  { id: '2', name: 'Sarah', avatar: 'luna', pnl: 1820, bets: 12, winRate: 67, isOnline: true },
  { id: '3', name: 'David', avatar: 'max', pnl: -340, bets: 18, winRate: 44, isOnline: false },
  { id: '4', name: 'Emma', avatar: 'bella', pnl: 980, bets: 8, winRate: 75, isOnline: true },
  { id: '5', name: 'James', avatar: 'charlie', pnl: -120, bets: 10, winRate: 40, isOnline: false },
  { id: '6', name: 'Lisa', avatar: 'mia', pnl: 450, bets: 6, winRate: 67, isOnline: false },
  { id: '7', name: 'You', avatar: 'leo', pnl: 320, bets: 5, winRate: 60, isOnline: true, isYou: true },
];

function getAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=7311d4,E42575,10B981&backgroundType=gradientLinear`;
}

export default function GroupPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7311d4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPnl = mockMembers.reduce((sum, m) => sum + m.pnl, 0);
  const onlineCount = mockMembers.filter(m => m.isOnline).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>

          {/* Group Header */}
          <Card className="mb-6">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7311d4] to-[#E42575] flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-3xl">groups</span>
                  </div>
                  <div>
                    <h1 className="text-white text-2xl lg:text-3xl font-bold">{mockGroup.name}</h1>
                    <p className="text-white/50 text-sm mt-1">{mockGroup.description}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm">
                    <span className="material-symbols-outlined">share</span>
                    Invite
                  </Button>
                  <Button size="sm">
                    <span className="material-symbols-outlined">settings</span>
                    Manage
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Members</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-2xl font-bold">{mockMembers.length}</p>
                    <span className="text-[#10B981] text-xs">({onlineCount} online)</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Total Wagered</p>
                  <p className="text-white text-2xl font-bold">{mockGroup.totalWagered.toLocaleString()} <span className="text-sm font-normal text-white/50">USDC</span></p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Active Bets</p>
                  <p className="text-white text-2xl font-bold">{mockGroup.activeBets}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Settled</p>
                  <p className="text-white text-2xl font-bold">{mockGroup.settledBets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Members List */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-bold">Members</h2>
                <div className="text-sm text-white/50">
                  Sorted by P&L
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/50 text-xs uppercase tracking-wider font-medium p-4 pl-0">Member</th>
                      <th className="text-right text-white/50 text-xs uppercase tracking-wider font-medium p-4">P&L</th>
                      <th className="text-right text-white/50 text-xs uppercase tracking-wider font-medium p-4 hidden sm:table-cell">Bets</th>
                      <th className="text-right text-white/50 text-xs uppercase tracking-wider font-medium p-4 hidden sm:table-cell">Win Rate</th>
                      <th className="text-right text-white/50 text-xs uppercase tracking-wider font-medium p-4 pr-0">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockMembers
                      .sort((a, b) => b.pnl - a.pnl)
                      .map((member, index) => (
                      <tr 
                        key={member.id}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                          member.isYou ? 'bg-[#7311d4]/10' : ''
                        }`}
                      >
                        <td className="p-4 pl-0">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img 
                                src={getAvatarUrl(member.avatar)} 
                                alt={member.name}
                                className="w-10 h-10 rounded-full ring-2 ring-white/10"
                              />
                              {member.isOnline && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10B981] ring-2 ring-[#191022]" />
                              )}
                            </div>
                            <div>
                              <span className={`font-medium ${member.isYou ? 'text-[#7311d4]' : 'text-white'}`}>
                                {member.name}
                              </span>
                              {index === 0 && (
                                <span className="ml-2 text-xs">👑</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-bold ${
                            member.pnl > 0 ? 'text-[#10B981]' : member.pnl < 0 ? 'text-[#E42575]' : 'text-white/50'
                          }`}>
                            {member.pnl > 0 ? '+' : ''}{member.pnl.toLocaleString()}
                          </span>
                          <span className="text-white/40 text-sm ml-1">USDC</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className="text-white">{member.bets}</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className={`font-medium ${
                            member.winRate >= 60 ? 'text-[#10B981]' : 
                            member.winRate >= 50 ? 'text-yellow-400' : 'text-[#E42575]'
                          }`}>
                            {member.winRate}%
                          </span>
                        </td>
                        <td className="p-4 pr-0 text-right">
                          {member.isOnline ? (
                            <span className="text-[#10B981] text-xs font-medium">Online</span>
                          ) : (
                            <span className="text-white/30 text-xs">Offline</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-white/50 text-xs">Total Group P&L</p>
                    <p className={`font-bold text-lg ${totalPnl >= 0 ? 'text-[#10B981]' : 'text-[#E42575]'}`}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()} USDC
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs">Avg Win Rate</p>
                    <p className="text-white font-bold text-lg">
                      {Math.round(mockMembers.reduce((sum, m) => sum + m.winRate, 0) / mockMembers.length)}%
                    </p>
                  </div>
                </div>
                
                <Link href="/bets/create">
                  <Button>
                    <span className="material-symbols-outlined">add</span>
                    New Bet
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

