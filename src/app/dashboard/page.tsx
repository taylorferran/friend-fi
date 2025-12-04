'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

// Prefetch these routes
const ROUTES_TO_PREFETCH = ['/bets/create', '/groups/create', '/groups/join', '/leaderboard', '/bets', '/expenses', '/accountability'];

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
    id: 'expenses',
    name: 'Split Expenses',
    icon: 'receipt_long',
    description: 'On-chain shared expense ledger',
    status: 'coming_soon',
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

  // Show group selection if no group is selected
  if (!hasGroup) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        
        <main className="flex-1 mobile-content p-4 sm:p-8 flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mb-6 p-4 bg-primary border-2 border-text w-fit mx-auto">
              <span className="material-symbols-outlined text-text text-4xl sm:text-5xl">group_add</span>
            </div>
            
            <h1 className="text-text text-2xl sm:text-3xl font-display font-bold mb-4">Welcome to Friend-Fi!</h1>
            <p className="text-accent mb-8 text-sm sm:text-base font-mono">
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content lg:p-0 lg:py-16">
        <div className="p-4 pt-6 pb-8 lg:p-8 lg:pt-0 lg:pb-0">
          {/* dApp Selector */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-accent text-xs uppercase tracking-wider font-mono font-bold">Select App</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {dApps.map((dapp) => (
                <button
                  key={dapp.id}
                  onClick={() => dapp.status === 'active' && setActiveDApp(dapp.id)}
                  disabled={dapp.status !== 'active'}
                  className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 border-2 transition-all duration-200 ${
                    activeDApp === dapp.id
                      ? 'bg-primary border-text text-text'
                      : dapp.status === 'active'
                      ? 'bg-surface border-text text-text hover:bg-primary/20'
                      : 'bg-surface/50 border-text/30 text-text/50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-10 h-10 flex items-center justify-center border-2 ${
                    activeDApp === dapp.id ? 'bg-surface border-text' : 'bg-background border-text'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{dapp.icon}</span>
                  </div>
                  <div className="text-left">
                    <div className="font-mono font-bold text-sm uppercase tracking-wider">{dapp.name}</div>
                    {dapp.status === 'coming_soon' ? (
                      <div className="text-[10px] text-primary font-mono font-bold uppercase">Coming Soon</div>
                    ) : (
                      <div className="text-xs font-mono opacity-70">{dapp.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight">
                Crypto Degens
              </h1>
              <p className="text-accent text-sm sm:text-base mt-1 font-mono">
                Total Wagered: 12,500 USDC
              </p>
            </div>
            
            {/* Search */}
            <div className="w-full lg:max-w-xs">
              <div className="flex items-center h-10 sm:h-12 bg-surface border-2 border-text">
                <span className="material-symbols-outlined text-accent pl-3 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search bets..."
                  className="flex-1 bg-transparent border-none text-text placeholder:text-accent px-2 focus:outline-none text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Mobile: Group Members Summary */}
          <div className="lg:hidden mb-6">
            <Link href="/groups/crypto-degens">
              <div className="flex items-center justify-between p-4 bg-surface border-2 border-text hover:bg-primary/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {mockMembers.slice(0, 3).map((avatar, i) => (
                      <img
                        key={i}
                        src={avatar}
                        alt={`Member ${i + 1}`}
                        className="w-8 h-8 border-2 border-text"
                      />
                    ))}
                  </div>
                  <span className="text-text text-sm font-mono font-bold">7 members</span>
                </div>
                <span className="material-symbols-outlined text-accent">chevron_right</span>
              </div>
            </Link>
          </div>

          {/* Content based on active dApp */}
          {activeDApp === 'predictions' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-6">
                {/* Tabs */}
                <div className="flex border-b-2 border-text">
                  <button
                    onClick={() => setActiveTab('active')}
                    className={`pb-3 pt-2 px-4 text-sm font-mono font-bold uppercase tracking-wider border-b-4 transition-colors ${
                      activeTab === 'active'
                        ? 'border-primary text-text'
                        : 'border-transparent text-accent hover:text-text'
                    }`}
                  >
                    Active Bets
                  </button>
                  <button
                    onClick={() => setActiveTab('past')}
                    className={`pb-3 pt-2 px-4 text-sm font-mono font-bold uppercase tracking-wider border-b-4 transition-colors ${
                      activeTab === 'past'
                        ? 'border-primary text-text'
                        : 'border-transparent text-accent hover:text-text'
                    }`}
                  >
                    Past Bets
                  </button>
                </div>

                {/* Bet Cards */}
                <div className="flex flex-col gap-3 sm:gap-4">
                  {mockBets.map((bet, index) => (
                    <Link key={bet.id} href={`/bets/${bet.id}`}>
                      <Card hover className={index === 0 ? 'border-l-4 border-l-primary' : ''}>
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex justify-between items-start gap-2 mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-display font-bold text-text leading-tight">{bet.question}</h3>
                            <span className="flex-shrink-0 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-1 border-2 border-blue-600">
                              Active
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 sm:gap-6">
                              <div>
                                <span className="text-accent text-xs sm:text-sm font-mono uppercase">Pool</span>
                                <p className="text-text font-display font-bold text-base sm:text-lg">{bet.pool.toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-accent text-xs sm:text-sm font-mono uppercase">Ends</span>
                                <p className="text-text font-display font-bold text-base sm:text-lg">{bet.endsAt}</p>
                              </div>
                            </div>
                            
                            <span className="material-symbols-outlined text-accent">chevron_right</span>
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
                      <h3 className="text-lg font-display font-bold text-text">Group Members</h3>
                      <Link href="/groups/crypto-degens" className="text-primary text-sm font-mono font-bold uppercase tracking-wider hover:underline">
                        View all
                      </Link>
                    </div>
                    <div className="flex items-center -space-x-3">
                      {mockMembers.map((avatar, i) => (
                        <img
                          key={i}
                          src={avatar}
                          alt={`Member ${i + 1}`}
                          className="w-11 h-11 border-2 border-text"
                        />
                      ))}
                      <button className="w-11 h-11 bg-surface text-sm font-mono font-bold text-text border-2 border-text hover:bg-primary/20 transition-colors">
                        +3
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Create Bet */}
                <Card className="sticky top-8">
                  <CardContent>
                    <h3 className="text-lg font-display font-bold text-text mb-4">Quick Create</h3>
                    
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder='e.g., "Will BTC hit $100k?"'
                        className="w-full h-11 border-2 border-text bg-background text-text placeholder:text-accent px-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
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

          {activeDApp === 'expenses' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-surface border-2 border-text flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-accent">receipt_long</span>
              </div>
              <h2 className="text-text text-2xl font-display font-bold mb-3">Split Expenses</h2>
              <p className="text-accent max-w-md mb-6 font-mono">
                On-chain shared expense ledger with rolling balances between group members. 
                Everyone can see who owes what—full accountability.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                {['Shared ledger', 'Rolling balances', 'USDC settlements', 'Full transparency'].map((feature) => (
                  <span key={feature} className="px-3 py-1 border-2 border-text bg-surface text-accent text-sm font-mono">
                    {feature}
                  </span>
                ))}
              </div>
              <Link href="/expenses">
                <Button>
                  <span className="material-symbols-outlined">visibility</span>
                  View Preview
                </Button>
              </Link>
            </div>
          )}

          {activeDApp === 'accountability' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-surface border-2 border-text flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-accent">fitness_center</span>
              </div>
              <h2 className="text-text text-2xl font-display font-bold mb-3">Accountability Tracker</h2>
              <p className="text-accent max-w-md mb-6 font-mono">
                Put your money where your mouth is. Wager on habits with friends—hit the gym 3x/week or lose your stake.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                {['Daily check-ins', 'Photo proof', 'Stake commitment'].map((feature) => (
                  <span key={feature} className="px-3 py-1 border-2 border-text bg-surface text-accent text-sm font-mono">
                    {feature}
                  </span>
                ))}
              </div>
              <Link href="/accountability">
                <Button>
                  <span className="material-symbols-outlined">visibility</span>
                  View Preview
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
