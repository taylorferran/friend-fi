'use client';

import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent } from '@/components/ui/Card';

export default function ExpensesPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();

  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 pt-8 pb-12 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Dashboard</span>
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-text/50 text-text/60 text-xs font-mono uppercase tracking-wider font-bold mb-4">
              COMING SOON
            </div>
            <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Split Expenses</h1>
            <p className="text-accent font-mono">On-chain shared expense ledger</p>
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-accent text-3xl">receipt_long</span>
              </div>
              <h3 className="text-text text-xl font-display font-bold mb-2">Coming Soon</h3>
              <p className="text-accent text-sm font-mono mb-6">
                Split Expenses will feature an on-chain shared expense ledger, rolling balances, 
                and USDC settlements with full transparency.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
