'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { checkIfMemberInGroup, getGroupMembers, getGroupBets, getGroupsCount, getGroupName, getProfile } from '@/lib/contract';
import { ProfileSetupModal } from '@/components/ui/ProfileSetupModal';
import { useToast } from '@/components/ui/Toast';
import { getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';

// Available dApps
const dApps = [
  {
    id: 'predictions',
    name: 'Predictions',
    icon: 'casino',
    status: 'active',
  },
  {
    id: 'expenses',
    name: 'Expenses',
    icon: 'receipt_long',
    status: 'coming_soon',
  },
  {
    id: 'accountability',
    name: 'Goals',
    icon: 'fitness_center',
    status: 'coming_soon',
  },
];

interface GroupData {
  id: number;
  name: string;
  memberCount: number;
  betCount: number;
}

export default function DashboardPage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const { wallet, loading: walletLoading, setProfile } = useMoveWallet();
  const { showToast } = useToast();
  const [activeDApp, setActiveDApp] = useState('predictions');
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  // Check if user has a profile on-chain
  useEffect(() => {
    async function checkProfile() {
      if (!wallet?.address || profileChecked) return;
      
      try {
        const profile = await getProfile(wallet.address);
        if (!profile.exists) {
          // No profile found, show setup modal
          setShowProfileSetup(true);
        }
        setProfileChecked(true);
      } catch (error) {
        console.error('Error checking profile:', error);
        setProfileChecked(true);
      }
    }
    
    checkProfile();
  }, [wallet?.address, profileChecked]);

  // Handle profile setup completion
  const handleProfileSetup = async (username: string, avatarId: number) => {
    if (!wallet?.address) return;
    
    setSavingProfile(true);
    try {
      const result = await setProfile(username, avatarId);
      
      // Save to session storage for immediate UI updates
      const settings = {
        username,
        avatarId,
        avatarUrl: getAvatarUrl(AVATAR_OPTIONS[avatarId].seed, AVATAR_OPTIONS[avatarId].style),
      };
      sessionStorage.setItem('friendfi_user_settings', JSON.stringify(settings));
      
      // Dispatch event to trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: settings }));
      
      showToast({
        type: 'success',
        title: 'Profile created!',
        message: 'Welcome to Friend-Fi',
        txHash: result.hash,
      });
      
      setShowProfileSetup(false);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to create profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Auth redirect is handled by AuthWrapper - no need here

  // Load user's groups - PARALLEL queries for speed
  useEffect(() => {
    async function loadGroups() {
      if (!wallet?.address) {
        return;
      }

      setGroupsLoading(true);
      try {
        const count = await getGroupsCount();
        
        if (count === 0) {
          setGroups([]);
          setGroupsLoading(false);
          return;
        }

        // Check ALL memberships in PARALLEL (huge speed improvement)
        const groupIds = Array.from({ length: count }, (_, i) => i);
        const membershipChecks = await Promise.all(
          groupIds.map(id => 
            checkIfMemberInGroup(id, wallet.address)
              .then(isMember => ({ id, isMember }))
              .catch(() => ({ id, isMember: false }))
          )
        );

        // Filter to groups user is a member of
        const userGroupIds = membershipChecks
          .filter(check => check.isMember)
          .map(check => check.id);

        if (userGroupIds.length === 0) {
          setGroups([]);
          setGroupsLoading(false);
          return;
        }

        // Get group name, members + bets for ALL user groups in PARALLEL - now with names!
        const groupDataPromises = userGroupIds.map(async (id) => {
          try {
            const [name, members, bets] = await Promise.all([
              getGroupName(id),
              getGroupMembers(id),
              getGroupBets(id),
            ]);
            return {
              id,
              name: name || `Group #${id}`,
              memberCount: members.length,
              betCount: bets.length,
            };
          } catch (error) {
            console.error(`Error loading group ${id}:`, error);
            return null;
          }
        });

        const groupDataResults = await Promise.all(groupDataPromises);
        const userGroups = groupDataResults.filter((g): g is GroupData => g !== null);

        setGroups(userGroups);
      } catch (error) {
        console.error('Error loading groups:', error);
      } finally {
        setGroupsLoading(false);
      }
    }

    if (wallet?.address) {
      loadGroups();
    }
  }, [wallet?.address]);

  const handleGroupClick = (group: GroupData) => {
    // Store group in session for bet creation
    sessionStorage.setItem('friendfi_current_group', JSON.stringify({
      id: group.id,
      name: group.name,
    }));
    router.push(`/groups/${group.id}`);
  };

  // Show loading while auth is checking
  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner-instant">
          <div className="brutalist-spinner-box-instant" />
          <div className="brutalist-spinner-box-instant" />
          <div className="brutalist-spinner-box-instant" />
          <div className="brutalist-spinner-box-instant" />
        </div>
      </div>
    );
  }

  // Determine if we're in a loading state
  const isLoading = walletLoading || groupsLoading;

  return (
    <>
      <ProfileSetupModal 
        isOpen={showProfileSetup}
        onComplete={handleProfileSetup}
        onSaving={savingProfile}
      />
      
      <div className="flex min-h-screen bg-background">
        <Sidebar />

        <main className="flex-1 mobile-content lg:p-0 lg:py-16">
        <div className="p-4 pt-8 pb-12 lg:p-8 lg:pt-0 lg:pb-0">
          {/* dApp Tabs */}
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {dApps.map((dapp) => (
                <button
                  key={dapp.id}
                  onClick={() => dapp.status === 'active' && setActiveDApp(dapp.id)}
                  disabled={dapp.status !== 'active'}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 border-2 transition-all duration-200 font-mono font-bold text-sm uppercase tracking-wider ${
                    activeDApp === dapp.id
                      ? 'bg-primary border-text text-text'
                      : dapp.status === 'active'
                      ? 'bg-surface border-text text-text hover:bg-primary/20'
                      : 'bg-surface/50 border-text/30 text-text/50 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{dapp.icon}</span>
                  <span>{dapp.name}</span>
                  {dapp.status === 'coming_soon' && (
                    <span className="text-[10px] text-primary">SOON</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Predictions Content */}
          {activeDApp === 'predictions' && (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight">
                    Your Groups
                  </h1>
                  <p className="text-accent text-sm mt-1 font-mono">
                    {isLoading ? 'Loading...' : groups.length === 0 ? 'Get started by creating or joining a group' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/groups/join">
                    <Button variant="secondary" className="text-sm">
                      <span className="material-symbols-outlined text-lg">group_add</span>
                      Join
                    </Button>
                  </Link>
                  <Link href="/groups/create">
                    <Button className="text-sm">
                      <span className="material-symbols-outlined text-lg">add</span>
                      Create
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Loading State */}
              {isLoading ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="brutalist-spinner-instant mx-auto mb-4">
                      <div className="brutalist-spinner-box-instant" />
                      <div className="brutalist-spinner-box-instant" />
                      <div className="brutalist-spinner-box-instant" />
                      <div className="brutalist-spinner-box-instant" />
                    </div>
                    <p className="text-accent font-mono text-sm">Loading your groups from the blockchain...</p>
                  </CardContent>
                </Card>
              ) : groups.length === 0 ? (
                <Card>
                  <CardContent className="p-8 sm:p-12 text-center">
                    <div className="w-20 h-20 bg-primary/20 border-2 border-text flex items-center justify-center mx-auto mb-6">
                      <span className="material-symbols-outlined text-4xl text-text">groups</span>
                    </div>
                    <h2 className="text-text text-2xl font-display font-bold mb-3">No Groups Yet</h2>
                    <p className="text-accent max-w-md mx-auto mb-8 font-mono">
                      Groups are where you and your friends create predictions and bet on outcomes. 
                      Create a new group or join an existing one to get started.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/groups/create">
                        <Button className="w-full sm:w-auto">
                          <span className="material-symbols-outlined">add_circle</span>
                          Create Group
                        </Button>
                      </Link>
                      <Link href="/groups/join">
                        <Button variant="secondary" className="w-full sm:w-auto">
                          <span className="material-symbols-outlined">group_add</span>
                          Join Group
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group) => (
                    <Card key={group.id} hover onClick={() => handleGroupClick(group)}>
                      <CardContent className="p-0">
                        {/* Group Header */}
                        <div className="p-4 border-b-2 border-text">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-text text-2xl">groups</span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-text text-lg font-display font-bold truncate">{group.name}</h3>
                              <p className="text-accent text-xs font-mono uppercase tracking-wider">
                                {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-lg">casino</span>
                            <span className="text-text font-mono font-bold">{group.betCount}</span>
                            <span className="text-accent text-sm font-mono">bet{group.betCount !== 1 ? 's' : ''}</span>
                          </div>
                          <span className="material-symbols-outlined text-accent">chevron_right</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Add New Group Card */}
                  <Link href="/groups/create">
                    <Card hover className="h-full border-dashed">
                      <CardContent className="p-4 h-full flex items-center justify-center min-h-[140px]">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-surface border-2 border-text border-dashed flex items-center justify-center mx-auto mb-3">
                            <span className="material-symbols-outlined text-accent text-2xl">add</span>
                          </div>
                          <p className="text-accent font-mono text-sm font-bold uppercase tracking-wider">New Group</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Expenses Coming Soon */}
          {activeDApp === 'expenses' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-surface border-2 border-text flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-accent">receipt_long</span>
              </div>
              <h2 className="text-text text-2xl font-display font-bold mb-3">Split Expenses</h2>
              <p className="text-accent max-w-md mb-6 font-mono">
                On-chain shared expense ledger with rolling balances. Coming soon!
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {['Shared ledger', 'Rolling balances', 'USDC settlements'].map((feature) => (
                  <span key={feature} className="px-3 py-1 border-2 border-text bg-surface text-accent text-sm font-mono">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Accountability Coming Soon */}
          {activeDApp === 'accountability' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-surface border-2 border-text flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-accent">fitness_center</span>
              </div>
              <h2 className="text-text text-2xl font-display font-bold mb-3">Goal Tracking</h2>
              <p className="text-accent max-w-md mb-6 font-mono">
                Put your money where your mouth is. Stake on habits with friends. Coming soon!
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {['Daily check-ins', 'Photo proof', 'Stake commitment'].map((feature) => (
                  <span key={feature} className="px-3 py-1 border-2 border-text bg-surface text-accent text-sm font-mono">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
    </>
  );
}
