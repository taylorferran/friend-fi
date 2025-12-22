'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getGroupMembers, getGroupName } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';

// Available apps within a group
const groupApps = [
  {
    id: 'private-predictions',
    name: 'Private Predictions',
    icon: 'casino',
    description: 'Create predictions, wager USDC, and settle bets within your group',
    features: ['Group-only betting', 'Admin-settled outcomes', 'Winner-takes-pool payouts'],
    status: 'active',
  },
  {
    id: 'expense-tracker',
    name: 'Expense Tracker',
    icon: 'receipt_long',
    description: 'Split expenses equally and settle debts with USDC',
    features: ['Shared expense ledger', 'Auto-split calculation', 'On-chain settlement'],
    status: 'active',
  },
  {
    id: 'habit-tracker',
    name: 'Habit Tracker',
    icon: 'fitness_center',
    description: 'Create habit commitments with group members and stake USDC on your goals',
    features: ['Weekly check-in commitments', 'Stake USDC on goals', 'Winner-takes-pool payouts'],
    status: 'active',
  },
];

interface MemberWithProfile {
  address: string;
  name?: string;
  avatarId?: number;
}

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated, ready } = useAuth();
  const { wallet } = useMoveWallet();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !authenticated) {
      // Removed /login redirect - show login prompt instead
    }
  }, [ready, authenticated, router]);

  // Store group context
  useEffect(() => {
    if (!isNaN(groupId) && groupName) {
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: groupId,
        name: groupName,
      }));
    }
  }, [groupId, groupName]);

  // Load group data
  useEffect(() => {
    async function loadGroupData() {
      if (isNaN(groupId)) {
        setLoading(false);
        return;
      }

      try {
        const [name, groupMembers] = await Promise.all([
          getGroupName(groupId),
          getGroupMembers(groupId),
        ]);

        setGroupName(name || `Group #${groupId}`);
        setMembers(groupMembers.map(address => ({ address })));
      } catch (error) {
        console.error('Error loading group data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [groupId]);

  // Show loading only if we're actually loading data, not blocking on auth

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 sm:p-6 pt-8 pb-12 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-4 sm:mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>Back to Dashboard</span>
          </Link>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="brutalist-spinner-instant mx-auto">
                  <div className="brutalist-spinner-box-instant"></div>
                  <div className="brutalist-spinner-box-instant"></div>
                  <div className="brutalist-spinner-box-instant"></div>
                  <div className="brutalist-spinner-box-instant"></div>
                </div>
                <p className="text-accent text-sm font-mono mt-4">Loading group...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Group Header */}
              <Card className="mb-4 sm:mb-6">
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-text text-xl sm:text-2xl">groups</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h1 className="text-text text-lg sm:text-xl lg:text-2xl font-display font-bold truncate">{groupName}</h1>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <p className="text-accent text-xs sm:text-sm font-mono">
                            {members.length} member{members.length !== 1 ? 's' : ''}
                          </p>
                          <span className="text-accent text-xs sm:text-sm font-mono">•</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-accent text-xs sm:text-sm font-mono">ID:</span>
                            <span className="text-text text-xs sm:text-sm font-mono font-bold bg-primary/20 px-2 py-0.5 border border-text">
                              {groupId}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* App Selection */}
              <div className="mb-4 sm:mb-6">
                <h2 className="text-text text-xl sm:text-2xl font-display font-bold mb-2 sm:mb-4">Choose an App</h2>
                <p className="text-accent font-mono text-xs sm:text-sm mb-4 sm:mb-6">
                  Select which app you want to use with this group
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {groupApps.map((app) => (
                  <Link key={app.id} href={`/groups/${groupId}/${app.id}`}>
                    <Card hover className="h-full">
                      <CardContent className="p-0">
                        {/* App Header */}
                        <div className="p-4 sm:p-6 border-b-2 border-text">
                          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-text text-xl sm:text-2xl">{app.icon}</span>
                            </div>
                            <div>
                              <h3 className="text-text text-lg sm:text-xl font-display font-bold">{app.name}</h3>
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 border-2 border-green-600 text-green-600 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider font-bold mt-1">
                                <span className="w-1.5 h-1.5 bg-green-600 animate-pulse" />
                                LIVE
                              </div>
                            </div>
                          </div>
                          <p className="text-accent font-mono text-xs sm:text-sm leading-relaxed">
                            {app.description}
                          </p>
                        </div>

                        {/* Features */}
                        <div className="p-4 sm:p-6">
                          <ul className="space-y-2">
                            {app.features.map((feature) => (
                              <li key={feature} className="flex items-center gap-2 text-text font-mono text-xs sm:text-sm">
                                <span className="material-symbols-outlined text-green-600 text-base sm:text-lg flex-shrink-0">check_circle</span>
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Action */}
                        <div className="p-6 pt-0">
                          <Button className="w-full">
                            Open {app.name}
                            <span className="material-symbols-outlined">arrow_forward</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
