'use client';

import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function AccountabilityPage() {
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
            <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-green-600 text-green-600 text-xs font-mono uppercase tracking-wider font-bold mb-4">
              <span className="w-2 h-2 bg-green-600 animate-pulse" />
              LIVE
            </div>
            <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Habit Tracker</h1>
            <p className="text-accent font-mono">Stake money on your habits and goals with group members</p>
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-primary border-2 border-text flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-text text-3xl">fitness_center</span>
              </div>
              <h3 className="text-text text-xl font-display font-bold mb-2">Access Through Groups</h3>
              <p className="text-accent text-sm font-mono mb-6">
                Habit Tracker is available within your groups. Create or join a group to start making habit commitments with friends.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/dashboard">
                  <Button variant="secondary">
                    <span className="material-symbols-outlined">groups</span>
                    Go to Groups
                  </Button>
                </Link>
                <Link href="/groups/create">
                  <Button>
                    <span className="material-symbols-outlined">add</span>
                    Create Group
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-text text-lg font-display font-bold mb-4">How It Works</h3>
                <ol className="space-y-3 text-sm text-accent font-mono list-decimal list-inside">
                  <li>Create or join a group with friends</li>
                  <li>Navigate to the group and select "Habit Tracker"</li>
                  <li>Create a commitment (e.g., "Gym 3x this week")</li>
                  <li>Both participants stake USDC</li>
                  <li>Check in throughout the week</li>
                  <li>Winner takes the pool at week's end!</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
