'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { useToast } from '@/components/ui/Toast';
import { getGroupMembers, getGroupName } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
import { removeGroupMember, getProfilesByAddresses } from '@/lib/supabase-services';
import { transferUSDC } from '@/lib/move-wallet';

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
    features: ['Shared expense ledger', 'Auto-split calculation', 'USDC settlement'],
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
  username?: string;
  avatarId?: number;
  avatarUrl?: string;
}

type Tab = 'apps' | 'members';

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated } = useAuth();
  const { wallet, refreshBalance } = useMoveWallet();
  const { showToast } = useToast();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('apps');
  const [leaving, setLeaving] = useState(false);
  const [transferAmounts, setTransferAmounts] = useState<Record<string, string>>({});
  const [transferring, setTransferring] = useState<Record<string, boolean>>({});

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
        
        // Load profiles for all members
        const profiles = await getProfilesByAddresses(groupMembers);
        const membersWithProfiles = groupMembers.map(address => {
          const profile = profiles.get(address);
          const avatar = profile ? getAvatarById(profile.avatar_id) : null;
          return {
            address,
            username: profile?.username,
            avatarId: profile?.avatar_id,
            avatarUrl: avatar ? getAvatarUrl(avatar.seed, avatar.style) : `https://api.dicebear.com/7.x/adventurer/svg?seed=${address}`,
          };
        });
        
        setMembers(membersWithProfiles);
      } catch (error) {
        console.error('Error loading group data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [groupId]);

  const handleLeaveGroup = async () => {
    if (!wallet?.address) {
      showToast({ type: 'error', title: 'Wallet not connected' });
      return;
    }

    if (!confirm(`Are you sure you want to leave ${groupName}?`)) {
      return;
    }

    setLeaving(true);
    try {
      await removeGroupMember(groupId, wallet.address);
      showToast({ 
        type: 'success', 
        title: 'Left group',
        message: `You have left ${groupName}`
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error leaving group:', error);
      showToast({ 
        type: 'error', 
        title: 'Failed to leave group',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLeaving(false);
    }
  };

  const handleTransfer = async (toAddress: string, username?: string) => {
    const amount = transferAmounts[toAddress];
    if (!amount || parseFloat(amount) <= 0) {
      showToast({ type: 'error', title: 'Invalid amount' });
      return;
    }

    if (!wallet?.address) {
      showToast({ type: 'error', title: 'Wallet not connected' });
      return;
    }

    setTransferring(prev => ({ ...prev, [toAddress]: true }));
    try {
      const result = await transferUSDC(toAddress, parseFloat(amount));
      
      if (result.success) {
        showToast({ 
          type: 'success', 
          title: 'Transfer successful',
          message: `Sent ${amount} USDC to ${username || toAddress.slice(0, 8) + '...'}`,
          txHash: result.hash
        });
        setTransferAmounts(prev => ({ ...prev, [toAddress]: '' }));
        refreshBalance();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Transfer failed:', error);
      showToast({ 
        type: 'error', 
        title: 'Transfer failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setTransferring(prev => ({ ...prev, [toAddress]: false }));
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
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
                    <Button
                      onClick={handleLeaveGroup}
                      loading={leaving}
                      variant="secondary"
                      className="w-full sm:w-auto"
                    >
                      <span className="material-symbols-outlined">logout</span>
                      Leave Group
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 sm:mb-6 border-b-2 border-text">
                <button
                  onClick={() => setActiveTab('apps')}
                  className={`px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider transition-colors relative ${
                    activeTab === 'apps'
                      ? 'text-text bg-primary'
                      : 'text-accent hover:text-text hover:bg-primary/20'
                  }`}
                >
                  Apps
                  {activeTab === 'apps' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider transition-colors relative ${
                    activeTab === 'members'
                      ? 'text-text bg-primary'
                      : 'text-accent hover:text-text hover:bg-primary/20'
                  }`}
                >
                  Members
                  {activeTab === 'members' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text" />
                  )}
                </button>
              </div>

              {/* Apps Tab */}
              {activeTab === 'apps' && (
                <>
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

              {/* Members Tab */}
              {activeTab === 'members' && (
                <>
                  <div className="mb-4 sm:mb-6">
                    <h2 className="text-text text-xl sm:text-2xl font-display font-bold mb-2 sm:mb-4">Group Members</h2>
                    <p className="text-accent font-mono text-xs sm:text-sm mb-4 sm:mb-6">
                      Send USDC to any member of your group
                    </p>
                  </div>

                  <div className="space-y-3">
                    {members.map((member) => (
                      <Card key={member.address}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Member Info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <img
                                src={member.avatarUrl}
                                alt={member.username || 'Anonymous'}
                                className="w-12 h-12 border-2 border-text flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-text font-mono font-bold truncate">
                                  {member.username || 'Anonymous'}
                                  {member.address === wallet?.address && (
                                    <span className="ml-2 text-xs text-accent">(You)</span>
                                  )}
                                </p>
                                <p className="text-accent font-mono text-xs truncate">
                                  {member.address.slice(0, 10)}...{member.address.slice(-8)}
                                </p>
                              </div>
                            </div>

                            {/* Transfer UI (only show for other members) */}
                            {member.address !== wallet?.address && (
                              <div className="flex gap-2 w-full sm:w-auto">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Amount"
                                  value={transferAmounts[member.address] || ''}
                                  onChange={(e) => setTransferAmounts(prev => ({ 
                                    ...prev, 
                                    [member.address]: e.target.value 
                                  }))}
                                  disabled={transferring[member.address]}
                                  className="flex-1 sm:w-32 h-12 border-2 border-text bg-surface text-text placeholder:text-accent/60 px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                />
                                <Button
                                  onClick={() => handleTransfer(member.address, member.username)}
                                  loading={transferring[member.address]}
                                  disabled={!transferAmounts[member.address] || parseFloat(transferAmounts[member.address]) <= 0}
                                  className="flex-shrink-0 h-12"
                                >
                                  <span className="material-symbols-outlined text-base">send</span>
                                  <span className="hidden sm:inline">Send USDC</span>
                                  <span className="sm:hidden">Send</span>
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
