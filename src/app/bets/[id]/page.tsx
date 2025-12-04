'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const mockBet = {
  id: '1',
  question: 'Will Alice and Bob follow through with the wedding?',
  creator: 'David',
  groupName: 'Crypto Degens',
  status: 'active',
  resolveDate: 'June 15, 2024',
  totalPool: 2450,
  yesPool: 1592.50,
  noPool: 857.50,
  yesBets: 8,
  noBets: 4,
  userBet: { choice: 'yes', amount: 50 },
  isAdmin: true,
};

const mockWagers = [
  { id: '1', user: 'Sarah', choice: 'yes', amount: 50, time: '2 hours ago', isYou: true },
  { id: '2', user: 'Michael', choice: 'yes', amount: 200, time: '5 hours ago', isYou: false },
  { id: '3', user: 'David', choice: 'no', amount: 350, time: '1 day ago', isYou: false },
  { id: '4', user: 'Emma', choice: 'yes', amount: 100, time: '2 days ago', isYou: false },
];

export default function ViewBetPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  
  const [prediction, setPrediction] = useState<'yes' | 'no'>('yes');
  const [wagerAmount, setWagerAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const yesPercentage = (mockBet.yesPool / mockBet.totalPool) * 100;
  const noPercentage = (mockBet.noPool / mockBet.totalPool) * 100;

  const calculatePotentialReturn = () => {
    const amount = parseFloat(wagerAmount) || 0;
    if (amount <= 0) return 0;
    
    if (prediction === 'yes') {
      const yourShare = amount / (mockBet.yesPool + amount);
      return amount + (mockBet.noPool * yourShare * 0.95);
    } else {
      const yourShare = amount / (mockBet.noPool + amount);
      return amount + (mockBet.yesPool * yourShare * 0.95);
    }
  };

  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wagerAmount || parseFloat(wagerAmount) <= 0) {
      alert('Please enter a wager amount');
      return;
    }

    setLoading(true);
    try {
      console.log('Placing bet:', { prediction, amount: wagerAmount });
      alert(`Bet placed: ${wagerAmount} USDC on ${prediction.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to place bet:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (outcome: 'yes' | 'no') => {
    if (!confirm(`Are you sure you want to settle this bet as ${outcome.toUpperCase()}?`)) return;
    
    try {
      console.log('Settling bet as:', outcome);
      alert(`Bet settled as ${outcome.toUpperCase()}`);
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to settle bet:', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 lg:p-8 lg:pt-12 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Group</span>
          </Link>

          <Card className="mb-6">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-3 py-1 border-2 border-blue-600 animate-pulse">
                      Active
                    </span>
                    <span className="text-accent text-sm font-mono">{mockBet.groupName}</span>
                  </div>
                  <h1 className="text-text text-2xl lg:text-3xl font-display font-bold leading-tight mb-3">
                    {mockBet.question}
                  </h1>
                  <p className="text-accent text-sm font-mono">
                    Created by <span className="text-text">{mockBet.creator}</span> · 
                    Resolves on <span className="text-text">{mockBet.resolveDate}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 bg-surface border-2 border-text text-accent hover:bg-primary/20 hover:text-text transition-colors">
                    <span className="material-symbols-outlined">share</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Total Pool</p>
                  <p className="text-text text-xl font-display font-bold">
                    {mockBet.totalPool.toLocaleString()} <span className="text-sm font-normal text-accent">USDC</span>
                  </p>
                </div>
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Total Bets</p>
                  <p className="text-text text-xl font-display font-bold">{mockBet.yesBets + mockBet.noBets}</p>
                </div>
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Your Bet</p>
                  <p className="text-green-600 text-xl font-display font-bold">
                    Yes · {mockBet.userBet.amount} <span className="text-sm font-normal">USDC</span>
                  </p>
                </div>
                <div className="bg-background border-2 border-text p-4">
                  <p className="text-accent text-xs font-mono uppercase tracking-wider mb-1">Potential Win</p>
                  <p className="text-text text-xl font-display font-bold">
                    ~87.50 <span className="text-sm font-normal text-accent">USDC</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardContent>
                <h3 className="text-text font-display font-bold text-lg mb-4">Betting Distribution</h3>
                
                <div className="mb-6">
                  <div className="flex h-12 overflow-hidden border-2 border-text">
                    <div 
                      className="bet-bar-yes flex items-center justify-center text-white font-mono font-bold text-sm transition-all"
                      style={{ width: `${yesPercentage}%` }}
                    >
                      {yesPercentage.toFixed(0)}%
                    </div>
                    <div 
                      className="bet-bar-no flex items-center justify-center text-white font-mono font-bold text-sm transition-all"
                      style={{ width: `${noPercentage}%` }}
                    >
                      {noPercentage.toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="border-2 border-green-600 bg-green-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-green-600 font-mono font-bold text-lg uppercase">Yes</span>
                      <span className="material-symbols-outlined text-green-600">thumb_up</span>
                    </div>
                    <p className="text-text text-2xl font-display font-bold">
                      {mockBet.yesPool.toLocaleString()} <span className="text-sm font-normal text-accent">USDC</span>
                    </p>
                    <p className="text-accent text-sm font-mono mt-1">{mockBet.yesBets} bets</p>
                  </div>
                  <div className="border-2 border-secondary bg-red-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-secondary font-mono font-bold text-lg uppercase">No</span>
                      <span className="material-symbols-outlined text-secondary">thumb_down</span>
                    </div>
                    <p className="text-text text-2xl font-display font-bold">
                      {mockBet.noPool.toLocaleString()} <span className="text-sm font-normal text-accent">USDC</span>
                    </p>
                    <p className="text-accent text-sm font-mono mt-1">{mockBet.noBets} bets</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="text-text font-display font-bold text-lg mb-4">Place Your Wager</h3>
                
                <form onSubmit={handlePlaceBet} className="flex flex-col gap-4">
                  <div>
                    <p className="text-accent text-sm font-mono uppercase tracking-wider mb-3">Your prediction</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="cursor-pointer">
                        <input 
                          type="radio" 
                          name="prediction" 
                          value="yes" 
                          checked={prediction === 'yes'}
                          onChange={() => setPrediction('yes')}
                          className="peer sr-only"
                        />
                        <div className="peer-checked:border-green-600 peer-checked:bg-green-50 border-2 border-text p-3 text-center transition-all hover:bg-primary/20">
                          <span className="material-symbols-outlined text-green-600 text-2xl mb-1">thumb_up</span>
                          <p className="text-text font-mono font-bold uppercase">Yes</p>
                        </div>
                      </label>
                      <label className="cursor-pointer">
                        <input 
                          type="radio" 
                          name="prediction" 
                          value="no"
                          checked={prediction === 'no'}
                          onChange={() => setPrediction('no')}
                          className="peer sr-only"
                        />
                        <div className="peer-checked:border-secondary peer-checked:bg-red-50 border-2 border-text p-3 text-center transition-all hover:bg-primary/20">
                          <span className="material-symbols-outlined text-secondary text-2xl mb-1">thumb_down</span>
                          <p className="text-text font-mono font-bold uppercase">No</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-accent text-sm font-mono uppercase tracking-wider mb-2 block">Wager amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={wagerAmount}
                        onChange={(e) => setWagerAmount(e.target.value)}
                        placeholder="0"
                        min="1"
                        className="w-full h-14 border-2 border-text bg-surface text-text text-xl font-display font-bold pl-4 pr-20 placeholder:text-accent/30 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <span className="absolute inset-y-0 right-4 flex items-center text-sm font-mono font-bold text-accent">USDC</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[10, 25, 50, 100].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setWagerAmount(amount.toString())}
                          className="flex-1 py-1 px-2 bg-surface border-2 border-text hover:bg-primary/20 text-text text-xs font-mono font-bold transition-colors"
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-background border-2 border-text p-3">
                    <div className="flex justify-between text-sm font-mono">
                      <span className="text-accent">Potential return</span>
                      <span className="text-text font-bold">~{calculatePotentialReturn().toFixed(2)} USDC</span>
                    </div>
                    <p className="text-accent/60 text-xs mt-1 font-mono">Twitch-style payout: lower risk, proportional rewards</p>
                  </div>

                  <Button type="submit" loading={loading}>
                    <span className="material-symbols-outlined">casino</span>
                    Place Wager
                  </Button>

                  <p className="text-center text-xs text-accent flex items-center justify-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-sm text-green-600">verified</span>
                    No gas fees - sponsored by Friend-Fi
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardContent>
              <h3 className="text-text font-display font-bold text-lg mb-4">All Wagers</h3>
              
              <div className="space-y-3">
                {mockWagers.map((wager) => (
                  <div 
                    key={wager.id}
                    className="flex items-center justify-between p-3 bg-background border-2 border-text hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 flex items-center justify-center border-2 ${
                        wager.choice === 'yes' ? 'bg-green-50 border-green-600' : 'bg-red-50 border-secondary'
                      }`}>
                        <span className={`material-symbols-outlined ${
                          wager.choice === 'yes' ? 'text-green-600' : 'text-secondary'
                        }`}>
                          {wager.choice === 'yes' ? 'thumb_up' : 'thumb_down'}
                        </span>
                      </div>
                      <div>
                        <p className="text-text font-mono font-bold">
                          {wager.user} {wager.isYou && <span className="text-accent text-sm">(You)</span>}
                        </p>
                        <p className="text-accent text-xs font-mono">{wager.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-bold uppercase ${wager.choice === 'yes' ? 'text-green-600' : 'text-secondary'}`}>
                        {wager.choice.charAt(0).toUpperCase() + wager.choice.slice(1)}
                      </p>
                      <p className="text-text text-sm font-mono">{wager.amount} USDC</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {mockBet.isAdmin && (
            <Card className="border-primary bg-primary/10">
              <CardContent>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-text text-2xl">admin_panel_settings</span>
                  <div className="flex-1">
                    <h3 className="text-text font-display font-bold text-lg mb-1">Admin Controls</h3>
                    <p className="text-accent text-sm font-mono mb-4">
                      You are the designated resolver for this bet. Once the outcome is known, settle the bet to distribute winnings.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={() => handleSettle('yes')}
                        className="bg-green-600 border-text hover:bg-green-700"
                      >
                        <span className="material-symbols-outlined">check_circle</span>
                        Settle as YES
                      </Button>
                      <Button 
                        onClick={() => handleSettle('no')}
                        variant="danger"
                      >
                        <span className="material-symbols-outlined">cancel</span>
                        Settle as NO
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
