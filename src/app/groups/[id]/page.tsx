'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getGroupMembers, getGroupBets, getGroupName, getBetDescription, getProfiles } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
// NOTE: Indexer imports removed - event queries take 29+ seconds
// import { getGroupBetsFromIndexer, getAllGroups } from '@/lib/indexer';

type Tab = 'bets' | 'members';

interface MemberWithProfile {
  address: string;
  name?: string;
  avatarId?: number;
}

interface BetInfo {
  id: number;
  description: string;
}

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated, ready } = usePrivy();
  const { wallet } = useMoveWallet();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [bets, setBets] = useState<BetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('bets');

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  // Store group context for bet creation (updates when groupName changes)
  useEffect(() => {
    if (!isNaN(groupId) && groupName) {
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: groupId,
        name: groupName,
      }));
    }
  }, [groupId, groupName]);

  // Load group data - FAST on-chain first, then enhance with indexer
  useEffect(() => {
    async function loadGroupData() {
      if (isNaN(groupId)) {
        setLoading(false);
        return;
      }

      try {
        // Load group name, members, and bets ALL IN PARALLEL - now using on-chain view functions!
        const [name, groupMembers, groupBets] = await Promise.all([
          getGroupName(groupId),
          getGroupMembers(groupId),
          getGroupBets(groupId),
        ]);

        // Set group name from contract
        setGroupName(name || `Group #${groupId}`);

        // Set members without profiles first (fast)
        setMembers(groupMembers.map(address => ({ address })));

        // Load bet descriptions in parallel
        Promise.all(
          groupBets.map(async (id) => {
            const description = await getBetDescription(id);
            return { id, description };
          })
        ).then(betsWithDescriptions => {
          setBets(betsWithDescriptions);
        }).catch(() => {
          // Fallback: bets without descriptions
          setBets(groupBets.map(id => ({ id, description: `Bet #${id}` })));
        });

        // Load profiles in parallel (don't block on this)
        getProfiles(groupMembers)
          .then(profiles => {
            const membersWithProfiles: MemberWithProfile[] = groupMembers.map(address => ({
              address,
              name: profiles.get(address)?.name,
              avatarId: profiles.get(address)?.avatarId,
            }));
            setMembers(membersWithProfiles);
          })
          .catch(() => {
            // Just use addresses without profiles
            setMembers(groupMembers.map(address => ({ address })));
          });

      } catch (error) {
        console.error('Error loading group data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [groupId]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner-instant">
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
          <div className="brutalist-spinner-box-instant"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 pt-8 pb-12 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Home</span>
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
              <Card className="mb-6">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary border-2 border-text flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-text text-2xl">groups</span>
                      </div>
                      <div>
                        <h1 className="text-text text-xl lg:text-2xl font-display font-bold">{groupName}</h1>
                        <p className="text-accent text-sm font-mono">
                          {members.length} member{members.length !== 1 ? 's' : ''} · {bets.length} bet{bets.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Link href={`/bets/create?groupId=${groupId}&groupName=${encodeURIComponent(groupName)}`}>
                      <Button>
                        <span className="material-symbols-outlined">add</span>
                        New Bet
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('bets')}
                  className={`flex items-center gap-2 px-4 py-2 border-2 transition-all font-mono font-bold text-sm uppercase tracking-wider ${
                    activeTab === 'bets'
                      ? 'bg-primary border-text text-text'
                      : 'bg-surface border-text text-text hover:bg-primary/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">casino</span>
                  Bets ({bets.length})
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`flex items-center gap-2 px-4 py-2 border-2 transition-all font-mono font-bold text-sm uppercase tracking-wider ${
                    activeTab === 'members'
                      ? 'bg-primary border-text text-text'
                      : 'bg-surface border-text text-text hover:bg-primary/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">people</span>
                  Members ({members.length})
                </button>
              </div>

              {/* Bets Tab */}
              {activeTab === 'bets' && (
                <Card>
                  <CardContent>
                    {bets.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-accent text-3xl">casino</span>
                        </div>
                        <h3 className="text-text text-xl font-display font-bold mb-2">No Bets Yet</h3>
                        <p className="text-accent text-sm font-mono mb-6 max-w-sm mx-auto">
                          Create the first prediction for your group to start betting!
                        </p>
                        <Link href={`/bets/create?groupId=${groupId}&groupName=${encodeURIComponent(groupName)}`}>
                          <Button>
                            <span className="material-symbols-outlined">add</span>
                            Create First Bet
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {bets.map((bet) => (
                          <Link key={bet.id} href={`/bets/${bet.id}`}>
                            <div className="p-4 border-2 border-text bg-background hover:bg-primary/10 transition-colors cursor-pointer">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-primary/20 border-2 border-text flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-text">casino</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-text font-mono font-bold truncate">
                                      {bet.description || `Bet #${bet.id}`}
                                    </p>
                                    <p className="text-accent text-xs font-mono">Bet #{bet.id}</p>
                                  </div>
                                </div>
                                <span className="material-symbols-outlined text-accent flex-shrink-0">chevron_right</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <Card>
                  <CardContent>
                    {members.length === 0 ? (
                      <p className="text-accent text-sm font-mono text-center py-8">No members yet</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map((member, index) => {
                          const isYou = wallet?.address === member.address;
                          const avatar = member.avatarId !== undefined ? getAvatarById(member.avatarId) : null;
                          const avatarUrl = avatar ? getAvatarUrl(avatar.seed, avatar.style) : null;
                          
                          return (
                            <div
                              key={index}
                              className={`p-4 border-2 ${isYou ? 'border-primary bg-primary/10' : 'border-text/20 bg-background'}`}
                            >
                              <div className="flex items-center gap-3">
                                {avatarUrl ? (
                                  <img 
                                    src={avatarUrl} 
                                    alt={member.name || 'Member'} 
                                    className={`w-10 h-10 border-2 ${isYou ? 'border-primary' : 'border-text'}`}
                                  />
                                ) : (
                                  <div className={`w-10 h-10 border-2 flex items-center justify-center ${isYou ? 'bg-primary border-text' : 'bg-surface border-text'}`}>
                                    <span className="material-symbols-outlined text-text">person</span>
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-text font-mono font-bold text-sm flex items-center gap-2">
                                    {member.name || (isYou ? 'You' : `${member.address.slice(0, 8)}...${member.address.slice(-6)}`)}
                                    {isYou && (
                                      <span className="text-[10px] bg-primary text-text px-2 py-0.5 uppercase tracking-wider">You</span>
                                    )}
                                  </p>
                                  <p className="text-accent text-xs font-mono truncate">{member.address}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Share Group Info */}
                    <div className="mt-6 pt-6 border-t-2 border-text">
                      <div className="p-4 bg-primary/10 border-2 border-primary">
                        <p className="text-text font-mono font-bold text-sm mb-2">Invite Friends</p>
                        <p className="text-accent text-xs font-mono">
                          Share the Group ID <span className="text-text font-bold">#{groupId}</span> and password with friends so they can join.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
