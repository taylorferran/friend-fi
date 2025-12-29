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
import { getGroupMembers, getGroupBets, getGroupName, getBetDescription, getProfiles } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
import { useToast } from '@/components/ui/Toast';
import { transferUSDCFromFaucet } from '@/lib/move-wallet';
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

interface BetInfo {
  id: number;
  description: string;
}

export default function GroupPrivatePredictionsPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated } = useAuth();
  const { wallet } = useMoveWallet();
  const { showToast } = useToast();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [bets, setBets] = useState<BetInfo[]>([]);
  const [loading, setLoading] = useState(true);

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
        // Load group name and bets in parallel
        const [name, groupBets] = await Promise.all([
          getGroupName(groupId),
          getGroupBets(groupId),
        ]);

        // Set group name from contract
        setGroupName(name || `Group #${groupId}`);

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

      } catch (error) {
        console.error('Error loading group data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [groupId]);

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

      <main className="flex-1 mobile-content p-4 pt-8 pb-12 lg:p-8 lg:pt-16 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link 
            href={`/groups/${groupId}`}
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Group</span>
          </Link>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto">
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
                        <span className="material-symbols-outlined text-text text-2xl">casino</span>
                      </div>
                      <div>
                        <h1 className="text-text text-xl lg:text-2xl font-display font-bold">{groupName}</h1>
                        <p className="text-accent text-sm font-mono">
                          Private Predictions · {bets.length} bet{bets.length !== 1 ? 's' : ''}
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

              {/* Bets Section */}
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}

