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
import { getGroupMembers, getGroupName, getProfiles } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';

interface MemberWithProfile {
  address: string;
  name?: string;
  avatarId?: number;
}

export default function GroupHabitTrackerPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated, ready } = usePrivy();
  const { wallet } = useMoveWallet();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
      return;
    }

    async function loadGroupData() {
      if (!wallet?.address) return;

      try {
        const [name, memberAddresses] = await Promise.all([
          getGroupName(groupId),
          getGroupMembers(groupId),
        ]);

        if (name) setGroupName(name);

        // Get profiles for all members
        const profiles = await getProfiles(memberAddresses);
        const membersWithProfiles: MemberWithProfile[] = memberAddresses.map((addr) => {
          const profile = profiles.get(addr);
          return {
            address: addr,
            name: profile?.name,
            avatarId: profile?.avatarId,
          };
        });

        setMembers(membersWithProfiles);
      } catch (error) {
        console.error('Error loading group data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (wallet?.address) {
      loadGroupData();
    }
  }, [groupId, wallet?.address, authenticated, ready, router]);

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 pt-8 pb-12 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Link 
            href={`/groups/${groupId}`}
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to {groupName}</span>
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-green-600 text-green-600 text-xs font-mono uppercase tracking-wider font-bold mb-4">
              <span className="w-2 h-2 bg-green-600 animate-pulse" />
              LIVE
            </div>
            <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">
              Habit Tracker
            </h1>
            <p className="text-accent font-mono">Create habit commitments with {groupName} members</p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="brutalist-spinner-instant mx-auto mb-4">
                  <div className="brutalist-spinner-box-instant" />
                  <div className="brutalist-spinner-box-instant" />
                  <div className="brutalist-spinner-box-instant" />
                  <div className="brutalist-spinner-box-instant" />
                </div>
                <p className="text-accent font-mono text-sm">Loading habit tracker...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-primary border-2 border-text flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-text text-3xl">fitness_center</span>
                  </div>
                  <h3 className="text-text text-xl font-display font-bold mb-2">Habit Tracker is Live!</h3>
                  <p className="text-accent text-sm font-mono mb-6">
                    Create habit commitments with group members. Stake USDC on your goals and compete to win the pool.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/demo-habits">
                      <Button variant="secondary">
                        <span className="material-symbols-outlined">play_circle</span>
                        View Demo
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-text text-lg font-display font-bold mb-4">How It Works</h3>
                    <ol className="space-y-3 text-sm text-accent font-mono list-decimal list-inside mb-6">
                      <li>Create a commitment with another group member (e.g., "Gym 3x this week")</li>
                      <li>Both participants stake equal USDC amounts</li>
                      <li>Check in throughout the week to track progress</li>
                      <li>At week's end, the participant who met their goal wins the pool</li>
                      <li>If both succeed or both fail, the pool is split evenly</li>
                    </ol>
                    
                    <div className="mt-6 p-4 bg-surface border-2 border-text rounded-lg">
                      <p className="text-xs text-accent font-mono">
                        <span className="font-bold text-text">Note:</span> Full implementation coming soon. 
                        Check out the demo to see how it works!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {members.length > 0 && (
                <div className="mt-6">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-text text-lg font-display font-bold mb-4">
                        Group Members ({members.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {members.map((member) => (
                          <div
                            key={member.address}
                            className="flex items-center gap-3 p-3 bg-surface border-2 border-text rounded-lg"
                          >
                            {member.avatarId !== undefined ? (
                              <img
                                src={getAvatarUrl(
                                  getAvatarById(member.avatarId)?.seed || '',
                                  getAvatarById(member.avatarId)?.style || 'adventurer'
                                )}
                                alt={member.name || 'Member'}
                                className="w-10 h-10 rounded-full border-2 border-text"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-surface border-2 border-text flex items-center justify-center">
                                <span className="material-symbols-outlined text-accent">person</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-text font-mono font-bold text-sm truncate">
                                {member.name || 'Anonymous'}
                              </p>
                              <p className="text-accent font-mono text-xs truncate">
                                {member.address.slice(0, 6)}...{member.address.slice(-4)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

