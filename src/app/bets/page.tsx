'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

// Mock data
const mockBets = [
  {
    id: '1',
    question: 'Will Alice and Bob follow through with the wedding?',
    pool: 2450,
    status: 'active',
    choice: 'yes',
    amount: 50,
    endsAt: 'June 15, 2024',
  },
  {
    id: '2',
    question: 'Will ETH reach $4k by July 1st?',
    pool: 5200,
    status: 'active',
    choice: null,
    amount: null,
    endsAt: '12d 4h',
  },
  {
    id: '3',
    question: 'Will it rain on Sarah\'s birthday?',
    pool: 320,
    status: 'settled',
    choice: 'no',
    amount: 25,
    result: 'no',
    won: true,
    winnings: 47.50,
  },
];

export default function BetsPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const [filter, setFilter] = useState<'all' | 'active' | 'settled'>('all');

  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const filteredBets = mockBets.filter((bet) => {
    if (filter === 'all') return true;
    return bet.status === filter;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 pt-8 pb-8 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">My Bets</h1>
              <p className="text-accent font-mono">Track all your predictions and winnings.</p>
            </div>
            <Link href="/bets/create">
              <Button>
                <span className="material-symbols-outlined">add</span>
                New Bet
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="text-center py-4">
                <p className="text-text text-2xl font-display font-bold">3</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Total Bets</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <p className="text-text text-2xl font-display font-bold">2</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <p className="text-green-600 text-2xl font-display font-bold">1</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Won</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <p className="text-text text-2xl font-display font-bold">47.50</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">USDC Won</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-6">
            {(['all', 'active', 'settled'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-mono font-bold uppercase tracking-wider transition-colors border-2 ${
                  filter === f
                    ? 'bg-primary border-text text-text'
                    : 'bg-surface border-text text-text hover:bg-primary/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Bets List */}
          <div className="space-y-4">
            {filteredBets.map((bet) => (
              <Link key={bet.id} href={`/bets/${bet.id}`}>
                <Card hover className="mb-4">
                  <CardContent>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 border-2 ${
                            bet.status === 'active' 
                              ? 'text-blue-600 border-blue-600 bg-blue-100' 
                              : 'text-green-600 border-green-600 bg-green-100'
                          }`}>
                            {bet.status}
                          </span>
                          {bet.choice && (
                            <span className={`text-xs font-mono font-bold px-2 py-1 border-2 ${
                              bet.choice === 'yes' ? 'bg-green-100 text-green-600 border-green-600' : 'bg-red-100 text-secondary border-secondary'
                            }`}>
                              Your bet: {bet.choice.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <h3 className="text-text font-display font-bold text-lg mb-1">{bet.question}</h3>
                        <p className="text-accent text-sm font-mono">
                          Pool: {bet.pool.toLocaleString()} USDC
                          {bet.amount && ` · Your stake: ${bet.amount} USDC`}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {bet.status === 'settled' && bet.won && (
                          <div className="text-right">
                            <p className="text-green-600 font-display font-bold">+{bet.winnings} USDC</p>
                            <p className="text-accent text-xs font-mono uppercase">Won</p>
                          </div>
                        )}
                        {bet.status === 'active' && (
                          <div className="text-right">
                            <p className="text-accent font-mono">{bet.endsAt}</p>
                            <p className="text-accent/60 text-xs font-mono uppercase">Ends</p>
                          </div>
                        )}
                        <span className="material-symbols-outlined text-accent">chevron_right</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {filteredBets.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <span className="material-symbols-outlined text-accent text-5xl mb-4">casino</span>
                <p className="text-accent font-mono">No bets found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
