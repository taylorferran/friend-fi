'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const mockGroup = {
  id: 'crypto-degens',
  name: 'Crypto Degens',
  description: 'Predictions about crypto, markets, and degen plays',
  createdAt: 'Jan 15, 2024',
  totalWagered: 12500,
  activeBets: 3,
  settledBets: 12,
};

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
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner">
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
        </div>
      </div>
    );
  }

  const totalPnl = mockMembers.reduce((sum, m) => sum + m.pnl, 0);
  const onlineCount = mockMembers.filter(m => m.isOnline).length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 pt-8 pb-8 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Dashboard</span>
          </Link>

          <Card className="mb-6">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary border-2 border-text flex items-center justify-center">
                    <span className="material-symbols-outlined text-text text-3xl">groups</span>
                  </div>
                  <div>
                    <h1 className="text-text text-2xl lg:text-3xl font-display font-bold">{mockGroup.name}</h1>
                    <p className="text-accent text-sm font-mono mt-1">{mockGroup.description}</p>
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

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Members</p>
                  <div className="flex items-center gap-2">
                    <p className="text-text text-2xl font-display font-bold">{mockMembers.length}</p>
                    <span className="text-green-600 text-xs font-mono">({onlineCount} online)</span>
                  </div>
                </div>
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Total Wagered</p>
                  <p className="text-text text-2xl font-display font-bold">{mockGroup.totalWagered.toLocaleString()} <span className="text-sm font-normal text-accent">USDC</span></p>
                </div>
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Active Bets</p>
                  <p className="text-text text-2xl font-display font-bold">{mockGroup.activeBets}</p>
                </div>
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Settled</p>
                  <p className="text-text text-2xl font-display font-bold">{mockGroup.settledBets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-text text-xl font-display font-bold">Members</h2>
                <div className="text-sm text-accent font-mono">
                  Sorted by P&L
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-text">
                      <th className="text-left text-accent text-xs font-mono uppercase tracking-wider font-bold p-4 pl-0">Member</th>
                      <th className="text-right text-accent text-xs font-mono uppercase tracking-wider font-bold p-4">P&L</th>
                      <th className="text-right text-accent text-xs font-mono uppercase tracking-wider font-bold p-4 hidden sm:table-cell">Bets</th>
                      <th className="text-right text-accent text-xs font-mono uppercase tracking-wider font-bold p-4 hidden sm:table-cell">Win Rate</th>
                      <th className="text-right text-accent text-xs font-mono uppercase tracking-wider font-bold p-4 pr-0">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockMembers
                      .sort((a, b) => b.pnl - a.pnl)
                      .map((member, index) => (
                      <tr 
                        key={member.id}
                        className={`border-b-2 border-text/20 hover:bg-primary/10 transition-colors ${
                          member.isYou ? 'bg-primary/20' : ''
                        }`}
                      >
                        <td className="p-4 pl-0">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img 
                                src={getAvatarUrl(member.avatar)} 
                                alt={member.name}
                                className="w-10 h-10 border-2 border-text"
                              />
                              {member.isOnline && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-surface" />
                              )}
                            </div>
                            <div>
                              <span className={`font-mono font-bold ${member.isYou ? 'text-primary' : 'text-text'}`}>
                                {member.name}
                              </span>
                              {index === 0 && (
                                <span className="ml-2 text-xs">👑</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-display font-bold ${
                            member.pnl > 0 ? 'text-green-600' : member.pnl < 0 ? 'text-secondary' : 'text-accent'
                          }`}>
                            {member.pnl > 0 ? '+' : ''}{member.pnl.toLocaleString()}
                          </span>
                          <span className="text-accent text-sm font-mono ml-1">USDC</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className="text-text font-mono">{member.bets}</span>
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell">
                          <span className={`font-mono font-bold ${
                            member.winRate >= 60 ? 'text-green-600' : 
                            member.winRate >= 50 ? 'text-primary' : 'text-secondary'
                          }`}>
                            {member.winRate}%
                          </span>
                        </td>
                        <td className="p-4 pr-0 text-right">
                          {member.isOnline ? (
                            <span className="text-green-600 text-xs font-mono font-bold uppercase">Online</span>
                          ) : (
                            <span className="text-accent/50 text-xs font-mono uppercase">Offline</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-6 border-t-2 border-text flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-accent text-xs font-mono uppercase tracking-wider">Total Group P&L</p>
                    <p className={`font-display font-bold text-lg ${totalPnl >= 0 ? 'text-green-600' : 'text-secondary'}`}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()} USDC
                    </p>
                  </div>
                  <div>
                    <p className="text-accent text-xs font-mono uppercase tracking-wider">Avg Win Rate</p>
                    <p className="text-text font-display font-bold text-lg">
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
