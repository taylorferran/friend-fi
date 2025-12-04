'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

// Mock expense data
const mockExpenses = [
  { id: '1', description: 'Dinner at Nobu', amount: 320, paidBy: 'Michael', date: 'Dec 2, 2024', split: 4 },
  { id: '2', description: 'Uber to airport', amount: 85, paidBy: 'Sarah', date: 'Dec 1, 2024', split: 3 },
  { id: '3', description: 'AirBnB weekend', amount: 450, paidBy: 'You', date: 'Nov 28, 2024', split: 4 },
];

const mockBalances = [
  { user: 'Michael', avatar: 'felix', balance: 127.50, owesYou: true },
  { user: 'Sarah', avatar: 'luna', balance: 45.00, owesYou: false },
  { user: 'David', avatar: 'max', balance: 82.25, owesYou: true },
];

export default function ExpensesPage() {
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 lg:p-8 lg:pt-12 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Coming Soon Banner */}
          <div className="mb-8 p-4 bg-primary border-4 border-text">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-text text-2xl">construction</span>
              <div>
                <h2 className="text-text font-display font-bold text-lg">Coming Soon</h2>
                <p className="text-text/80 font-mono text-sm">This is a preview of Split Expenses. Full functionality launching Q1 2025.</p>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link href="/dashboard" className="text-accent hover:text-text transition-colors">
                  <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight">Split Expenses</h1>
              </div>
              <p className="text-accent font-mono">Crypto Degens · 4 members</p>
            </div>
            <Button disabled className="opacity-50">
              <span className="material-symbols-outlined">add</span>
              Add Expense
            </Button>
          </div>

          {/* Balances Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="text-center py-6">
                <span className="material-symbols-outlined text-green-600 text-3xl mb-2">trending_up</span>
                <p className="text-green-600 text-2xl font-display font-bold">+$209.75</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">You're Owed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-6">
                <span className="material-symbols-outlined text-secondary text-3xl mb-2">trending_down</span>
                <p className="text-secondary text-2xl font-display font-bold">-$45.00</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">You Owe</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-6">
                <span className="material-symbols-outlined text-primary text-3xl mb-2">account_balance</span>
                <p className="text-text text-2xl font-display font-bold">+$164.75</p>
                <p className="text-accent text-sm font-mono uppercase tracking-wider">Net Balance</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Expenses */}
            <div>
              <h2 className="text-text text-xl font-display font-bold mb-4">Recent Expenses</h2>
              <div className="space-y-4">
                {mockExpenses.map((expense) => (
                  <Card key={expense.id} hover>
                    <CardContent>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-text font-display font-bold">{expense.description}</h3>
                          <p className="text-accent text-sm font-mono">
                            Paid by {expense.paidBy} · Split {expense.split} ways
                          </p>
                          <p className="text-accent/60 text-xs font-mono mt-1">{expense.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-text font-display font-bold text-lg">${expense.amount}</p>
                          <p className="text-accent text-xs font-mono">${(expense.amount / expense.split).toFixed(2)}/person</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Settle Up */}
            <div>
              <h2 className="text-text text-xl font-display font-bold mb-4">Balances</h2>
              <div className="space-y-4">
                {mockBalances.map((balance) => (
                  <Card key={balance.user}>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${balance.avatar}`}
                            alt={balance.user}
                            className="w-12 h-12 border-2 border-text"
                          />
                          <div>
                            <p className="text-text font-mono font-bold">{balance.user}</p>
                            <p className={`text-sm font-mono ${balance.owesYou ? 'text-green-600' : 'text-secondary'}`}>
                              {balance.owesYou ? 'Owes you' : 'You owe'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className={`font-display font-bold text-xl ${balance.owesYou ? 'text-green-600' : 'text-secondary'}`}>
                            ${balance.balance.toFixed(2)}
                          </p>
                          <Button size="sm" disabled className="opacity-50">
                            Settle
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-6 p-4 border-2 border-dashed border-text/30 text-center">
                <span className="material-symbols-outlined text-accent text-3xl mb-2">payments</span>
                <p className="text-accent font-mono text-sm">
                  Settle up instantly with USDC. One click, on-chain settlement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

