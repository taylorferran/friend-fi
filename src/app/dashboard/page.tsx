'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

// Prefetch these routes
const ROUTES_TO_PREFETCH = ['/bets/create', '/groups/create', '/groups/join', '/leaderboard', '/bets'];

// Mock data for demonstration
const mockBets = [
  {
    id: '1',
    question: 'Will ETH reach $4k by July 1st?',
    pool: 5200,
    status: 'active',
    endsAt: '12d 4h 30m',
  },
  {
    id: '2',
    question: 'Will the Bitcoin halving push BTC past $80k in May?',
    pool: 7300,
    status: 'active',
    endsAt: 'May 31, 2024',
  },
];

const mockMembers = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=luna',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=max',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=bella',
];

// Available dApps
const dApps = [
  {
    id: 'predictions',
    name: 'Private Predictions',
    icon: 'casino',
    description: 'Create and wager on predictions with friends',
    status: 'active',
  },
  {
    id: 'accountability',
    name: 'Accountability Tracker',
    icon: 'fitness_center',
    description: 'Stake money on your habits and goals',
    status: 'coming_soon',
  },
];

export default function DashboardPage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [hasGroup, setHasGroup] = useState(false);
  const [activeDApp, setActiveDApp] = useState('predictions');

  // Check for group in session storage
  useEffect(() => {
    const group = sessionStorage.getItem('friendfi_current_group');
    setHasGroup(!!group);
  }, []);

  // Prefetch routes for faster navigation
  useEffect(() => {
    ROUTES_TO_PREFETCH.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  // Redirect to login if not authenticated
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

  // Show group selection if no group is selected
  if (!hasGroup) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        
        <main className="flex-1 mobile-content p-4 sm:p-8 flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mb-6 p-4 bg-[#7311d4]/20 rounded-full w-fit mx-auto">
              <span className="material-symbols-outlined text-[#7311d4] text-4xl sm:text-5xl">group_add</span>
            </div>
            
            <h1 className="text-white text-2xl sm:text-3xl font-bold mb-4">Welcome to Friend-Fi!</h1>
            <p className="text-white/70 mb-8 text-sm sm:text-base">
              To get started, create a new group or join an existing one.
            </p>
            
            <div className="flex flex-col gap-3">
              <Link href="/groups/create">
                <Button className="w-full">
                  <span className="material-symbols-outlined">add</span>
                  Create Group
                </Button>
              </Link>
              <Link href="/groups/join">
                <Button variant="secondary" className="w-full">
                  <span className="material-symbols-outlined">group</span>
                  Join Group
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 mobile-content lg:p-0">
        <div className="p-4 lg:p-8">
          {/* dApp Selector */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white/40 text-xs uppercase tracking-wider font-semibold">Select App</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {dApps.map((dapp) => (
                <button
                  key={dapp.id}
                  onClick={() => dapp.status === 'active' && setActiveDApp(dapp.id)}
                  disabled={dapp.status !== 'active'}
                  className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                    activeDApp === dapp.id
                      ? 'bg-[#7311d4]/20 border-[#7311d4]/50 text-white'
                      : dapp.status === 'active'
                      ? 'bg-[#191022]/50 border-white/10 text-white/70 hover:border-white/20 hover:text-white'
                      : 'bg-[#191022]/30 border-white/5 text-white/40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activeDApp === dapp.id ? 'bg-[#7311d4]/30' : 'bg-white/10'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{dapp.icon}</span>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{dapp.name}</div>
                    {dapp.status === 'coming_soon' ? (
                      <div className="text-[10px] text-[#7311d4] font-medium">Coming Soon</div>
                    ) : (
                      <div className="text-xs text-white/40">{dapp.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
                Crypto Degens
              </h1>
              <p className="text-neutral-400 text-sm sm:text-base mt-1">
                Total Wagered: 12,500 USDC
              </p>
            </div>
            
            {/* Search - Full width on mobile */}
            <div className="w-full lg:max-w-xs">
              <div className="flex items-center h-10 sm:h-12 rounded-lg bg-[#191022]/50 border border-white/10">
                <span className="material-symbols-outlined text-neutral-400 pl-3 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search bets..."
                  className="flex-1 bg-transparent border-none text-white placeholder:text-neutral-400 px-2 focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Mobile: Group Members Summary */}
          <div className="lg:hidden mb-6">
            <Link href="/groups/crypto-degens">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#191022]/50 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {mockMembers.slice(0, 3).map((avatar, i) => (
                      <img
                        key={i}
                        src={avatar}
                        alt={`Member ${i + 1}`}
                        className="w-8 h-8 rounded-full ring-2 ring-[#191022]"
                      />
                    ))}
                  </div>
                  <span className="text-white text-sm font-medium">7 members</span>
                </div>
                <span className="material-symbols-outlined text-white/50">chevron_right</span>
              </div>
            </Link>
          </div>

          {/* Content based on active dApp */}
          {activeDApp === 'predictions' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-6">
                {/* Tabs */}
                <div className="flex border-b border-white/10 gap-6 sm:gap-8">
                  <button
                    onClick={() => setActiveTab('active')}
                    className={`pb-3 pt-2 text-sm font-bold tracking-wide border-b-[3px] transition-colors ${
                      activeTab === 'active'
                        ? 'border-[#7311d4] text-white'
                        : 'border-transparent text-neutral-400 hover:text-white'
                    }`}
                  >
                    Active Bets
                  </button>
                  <button
                    onClick={() => setActiveTab('past')}
                    className={`pb-3 pt-2 text-sm font-bold tracking-wide border-b-[3px] transition-colors ${
                      activeTab === 'past'
                        ? 'border-[#7311d4] text-white'
                        : 'border-transparent text-neutral-400 hover:text-white'
                    }`}
                  >
                    Past Bets
                  </button>
                </div>

                {/* Bet Cards */}
                <div className="flex flex-col gap-3 sm:gap-4">
                  {mockBets.map((bet, index) => (
                    <Link key={bet.id} href={`/bets/${bet.id}`}>
                      <Card hover className={index === 0 ? 'border-l-4 border-l-[#7311d4]' : ''}>
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex justify-between items-start gap-2 mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-bold text-white leading-tight">{bet.question}</h3>
                            <span className="flex-shrink-0 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full">
                              Active
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 sm:gap-6">
                              <div>
                                <span className="text-neutral-400 text-xs sm:text-sm">Pool</span>
                                <p className="text-white font-bold text-base sm:text-lg">{bet.pool.toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-neutral-400 text-xs sm:text-sm">Ends</span>
                                <p className="text-white font-bold text-base sm:text-lg">{bet.endsAt}</p>
                              </div>
                            </div>
                            
                            <span className="material-symbols-outlined text-white/40">chevron_right</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Right Sidebar - Hidden on mobile */}
              <div className="hidden lg:flex lg:col-span-4 flex-col gap-6">
                {/* Group Members */}
                <Card>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">Group Members</h3>
                      <Link href="/groups/crypto-degens" className="text-[#7311d4] text-sm hover:underline">
                        View all
                      </Link>
                    </div>
                    <div className="flex items-center -space-x-3">
                      {mockMembers.map((avatar, i) => (
                        <img
                          key={i}
                          src={avatar}
                          alt={`Member ${i + 1}`}
                          className="w-11 h-11 rounded-full ring-2 ring-[#191022] bg-[#7311d4]/20"
                        />
                      ))}
                      <button className="w-11 h-11 rounded-full bg-neutral-700 text-sm font-bold text-white ring-2 ring-[#191022] hover:bg-neutral-600 transition-colors">
                        +3
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Create Bet */}
                <Card className="sticky top-8">
                  <CardContent>
                    <h3 className="text-lg font-bold text-white mb-4">Quick Create</h3>
                    
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder='e.g., "Will BTC hit $100k?"'
                        className="w-full h-11 rounded-lg border-none bg-[#191022] text-white placeholder:text-neutral-400 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#7311d4]"
                      />

                      <Link href="/bets/create" className="block">
                        <Button className="w-full">
                          Create New Bet
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeDApp === 'accountability' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-white/40">fitness_center</span>
              </div>
              <h2 className="text-white text-2xl font-bold mb-3">Accountability Tracker</h2>
              <p className="text-white/60 max-w-md mb-6">
                Put your money where your mouth is. Wager on habits with friends—hit the gym 3x/week or lose your stake.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                {['Daily check-ins', 'Photo proof', 'Stake commitment'].map((feature) => (
                  <span key={feature} className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-sm">
                    {feature}
                  </span>
                ))}
              </div>
              <div className="px-4 py-2 rounded-full bg-[#7311d4]/20 text-[#7311d4] text-sm font-semibold">
                Coming Q1 2025
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
