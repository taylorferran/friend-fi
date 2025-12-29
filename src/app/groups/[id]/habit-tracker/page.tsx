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
import { 
  getGroupMembers, 
  getGroupName, 
  getProfiles,
  getGroupCommitmentsCount,
  getCommitmentData,
  buildCreateCommitmentPayload,
  buildAcceptCommitmentPayload,
  buildCheckInPayload,
  buildProcessWeekPayload,
  type CommitmentData
} from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
import { useToast } from '@/components/ui/Toast';

interface MemberWithProfile {
  address: string;
  name?: string;
  avatarId?: number;
}

export default function GroupHabitTrackerPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated } = useAuth();
  const { wallet, signAndSubmitTransaction } = useMoveWallet();
  const { showToast } = useToast();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<CommitmentData[]>([]);
  const [loadingCommitments, setLoadingCommitments] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Create commitment form state
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [commitmentName, setCommitmentName] = useState('');
  const [weeklyPayout, setWeeklyPayout] = useState('');
  const [weeklyCheckIns, setWeeklyCheckIns] = useState('3');
  const [durationWeeks, setDurationWeeks] = useState('4');

  useEffect(() => {
    async function loadGroupData() {
      if (!wallet?.address) {
        setLoading(false);
        return;
      }

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

    loadGroupData();
  }, [groupId, wallet?.address]);

  // Load commitments
  useEffect(() => {
    async function loadCommitments() {
      if (!wallet?.address || loading) return;

      setLoadingCommitments(true);
      try {
        const count = await getGroupCommitmentsCount(groupId);
        const commitmentPromises: Promise<CommitmentData | null>[] = [];
        
        for (let i = 0; i < count; i++) {
          commitmentPromises.push(getCommitmentData(groupId, i));
        }

        const results = await Promise.all(commitmentPromises);
        setCommitments(results.filter((c): c is CommitmentData => c !== null));
      } catch (error) {
        console.error('Error loading commitments:', error);
      } finally {
        setLoadingCommitments(false);
      }
    }

    loadCommitments();
  }, [groupId, wallet?.address, loading]);

  const handleCreateCommitment = async () => {
    if (!wallet || !selectedParticipant || !commitmentName || !weeklyPayout) {
      showToast({ type: 'error', title: 'Please fill in all fields' });
      return;
    }

    const payoutAmount = parseFloat(weeklyPayout);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      showToast({ type: 'error', title: 'Weekly payout must be a positive number' });
      return;
    }

    setProcessing(true);
    try {
      // Step 1: Request membership signature
      console.log('[CreateCommitment] Requesting membership signature...');
      const { requestMembershipSignature } = await import('@/lib/signature-service');
      const proof = await requestMembershipSignature(groupId, wallet.address);
      console.log('[CreateCommitment] Signature received');
      
      // Step 2: Build payload with signature
      const payload = buildCreateCommitmentPayload(
        groupId,
        proof.signature,
        proof.expiresAt,
        selectedParticipant,
        Math.floor(payoutAmount * 1_000_000), // Convert to micro USDC
        parseInt(weeklyCheckIns),
        parseInt(durationWeeks),
        commitmentName
      );

      const result = await signAndSubmitTransaction(payload);
      
      if (result.success) {
        showToast({
          type: 'success',
          title: 'Commitment created!',
          message: 'Waiting for the other participant to accept...',
          txHash: result.hash,
        });
        setShowCreateModal(false);
        setCommitmentName('');
        setWeeklyPayout('');
        setSelectedParticipant('');
        
        // Reload commitments after a delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast({ type: 'error', title: 'Failed to create commitment' });
      }
    } catch (error) {
      console.error('Error creating commitment:', error);
      showToast({ 
        type: 'error', 
        title: 'Transaction failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleAcceptCommitment = async (commitmentId: number) => {
    if (!wallet) return;

    setProcessing(true);
    try {
      // Step 1: Request membership signature
      console.log('[AcceptCommitment] Requesting membership signature...');
      const { requestMembershipSignature } = await import('@/lib/signature-service');
      const proof = await requestMembershipSignature(groupId, wallet.address);
      console.log('[AcceptCommitment] Signature received');
      
      // Step 2: Build payload with signature
      const payload = buildAcceptCommitmentPayload(groupId, proof.signature, proof.expiresAt, commitmentId);
      const result = await signAndSubmitTransaction(payload);

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Commitment accepted!',
          message: 'You can now start checking in.',
          txHash: result.hash,
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast({ type: 'error', title: 'Failed to accept commitment' });
      }
    } catch (error) {
      console.error('Error accepting commitment:', error);
      showToast({ 
        type: 'error', 
        title: 'Transaction failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckIn = async (commitmentId: number) => {
    if (!wallet) return;

    setProcessing(true);
    try {
      const payload = buildCheckInPayload(groupId, commitmentId);
      const result = await signAndSubmitTransaction(payload);

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Check-in recorded!',
          txHash: result.hash,
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast({ type: 'error', title: 'Failed to check in' });
      }
    } catch (error) {
      console.error('Error checking in:', error);
      showToast({ 
        type: 'error', 
        title: 'Transaction failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessWeek = async (commitmentId: number, week: number) => {
    if (!wallet) return;

    setProcessing(true);
    try {
      const payload = buildProcessWeekPayload(groupId, commitmentId, week);
      const result = await signAndSubmitTransaction(payload);

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Week processed!',
          message: 'Payouts have been distributed.',
          txHash: result.hash,
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast({ type: 'error', title: 'Failed to process week' });
      }
    } catch (error) {
      console.error('Error processing week:', error);
      showToast({ 
        type: 'error', 
        title: 'Transaction failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getMemberName = (address: string) => {
    const member = members.find(m => m.address === address);
    return member?.name || address.slice(0, 6) + '...' + address.slice(-4);
  };

  const getMemberAvatar = (address: string) => {
    const member = members.find(m => m.address === address);
    if (member?.avatarId !== undefined) {
      const avatar = getAvatarById(member.avatarId);
      return getAvatarUrl(avatar?.seed || '', avatar?.style || 'adventurer');
    }
    return null;
  };

  const isParticipant = (commitment: CommitmentData) => {
    if (!wallet?.address) return false;
    return commitment.participantA === wallet.address || commitment.participantB === wallet.address;
  };

  const isParticipantA = (commitment: CommitmentData) => {
    if (!wallet?.address) return false;
    return commitment.participantA === wallet.address;
  };

  const canAccept = (commitment: CommitmentData) => {
    if (!wallet?.address) return false;
    return !commitment.accepted && commitment.participantB === wallet.address;
  };

  const canCheckIn = (commitment: CommitmentData) => {
    if (!wallet?.address) return false;
    if (!commitment.accepted) return false;
    if (commitment.currentWeek >= commitment.durationWeeks) return false;
    return isParticipant(commitment);
  };

  const canProcessWeek = (commitment: CommitmentData) => {
    if (!wallet?.address) return false;
    if (!commitment.accepted) return false;
    if (commitment.currentWeek >= commitment.durationWeeks) return false;
    if (commitment.weekProcessed) return false;
    // Only participant A can process the week
    return isParticipantA(commitment);
  };

  // Normalize addresses for comparison (remove 0x prefix and pad)
  const normalizeAddress = (addr: string) => {
    if (!addr) return '';
    const cleaned = addr.startsWith('0x') ? addr.slice(2) : addr;
    return cleaned.toLowerCase();
  };

  const otherParticipants = members.filter(m => {
    if (!wallet?.address) return true; // If no wallet, show all members
    return normalizeAddress(m.address) !== normalizeAddress(wallet.address);
  });

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
                  
                  
                  
                  
                </div>
                <p className="text-accent font-mono text-sm">Loading habit tracker...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Create Commitment Button */}
              <div className="mb-6">
                {!authenticated || !wallet ? (
                  <Card className="border-2 border-primary">
                    <CardContent className="p-4">
                      <p className="text-accent font-mono text-sm mb-3">
                        Sign in to create a commitment with another group member.
                      </p>
                    </CardContent>
                  </Card>
                ) : otherParticipants.length === 0 ? (
                  <Card className="border-2 border-secondary">
                    <CardContent className="p-4">
                      <p className="text-accent font-mono text-sm">
                        You need at least one other member in the group to create a commitment. Invite someone to join!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    disabled={processing}
                    className="w-full sm:w-auto"
                  >
                    <span className="material-symbols-outlined">add_circle</span>
                    Create Commitment
                  </Button>
                )}
              </div>

              {/* Create Commitment Modal */}
              {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <Card className="max-w-md w-full">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-text text-xl font-display font-bold">Create Commitment</h2>
                        <button
                          onClick={() => setShowCreateModal(false)}
                          className="text-accent hover:text-text"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-text text-sm font-mono font-bold uppercase tracking-wider block mb-2">
                            Commitment Name
                          </label>
                          <input
                            type="text"
                            value={commitmentName}
                            onChange={(e) => setCommitmentName(e.target.value)}
                            placeholder="e.g., Gym 3x per week"
                            className="w-full border-2 border-text bg-surface text-text p-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="text-text text-sm font-mono font-bold uppercase tracking-wider block mb-2">
                            Participant
                          </label>
                          <select
                            value={selectedParticipant}
                            onChange={(e) => setSelectedParticipant(e.target.value)}
                            className="w-full border-2 border-text bg-surface text-text p-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select a member...</option>
                            {otherParticipants.map((member) => (
                              <option key={member.address} value={member.address}>
                                {member.name || member.address.slice(0, 6) + '...' + member.address.slice(-4)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-text text-sm font-mono font-bold uppercase tracking-wider block mb-2">
                            Weekly Payout (USDC)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={weeklyPayout}
                            onChange={(e) => setWeeklyPayout(e.target.value)}
                            placeholder="0.10"
                            className="w-full border-2 border-text bg-surface text-text p-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <p className="text-xs text-accent font-mono mt-1">
                            Each participant stakes: ${(parseFloat(weeklyPayout) || 0) * (parseInt(durationWeeks) || 1) / 2} USDC
                          </p>
                        </div>

                        <div>
                          <label className="text-text text-sm font-mono font-bold uppercase tracking-wider block mb-2">
                            Check-ins Required Per Week
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={weeklyCheckIns}
                            onChange={(e) => setWeeklyCheckIns(e.target.value)}
                            className="w-full border-2 border-text bg-surface text-text p-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="text-text text-sm font-mono font-bold uppercase tracking-wider block mb-2">
                            Duration (Weeks)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={durationWeeks}
                            onChange={(e) => setDurationWeeks(e.target.value)}
                            className="w-full border-2 border-text bg-surface text-text p-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="flex gap-3 pt-4">
                          <Button
                            variant="secondary"
                            onClick={() => setShowCreateModal(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreateCommitment}
                            disabled={processing || !selectedParticipant || !commitmentName || !weeklyPayout}
                            className="flex-1"
                            loading={processing}
                          >
                            Create
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Commitments List */}
              {loadingCommitments ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="brutalist-spinner-instant mx-auto mb-4">
                      
                      
                      
                      
                    </div>
                    <p className="text-accent font-mono text-sm">Loading commitments...</p>
                  </CardContent>
                </Card>
              ) : commitments.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-primary border-2 border-text flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-text text-3xl">fitness_center</span>
                    </div>
                    <h3 className="text-text text-xl font-display font-bold mb-2">No Commitments Yet</h3>
                    <p className="text-accent text-sm font-mono mb-6">
                      Create a commitment with another group member to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {commitments.map((commitment) => {
                    const participantAName = getMemberName(commitment.participantA);
                    const participantBName = getMemberName(commitment.participantB);
                    const participantAAvatar = getMemberAvatar(commitment.participantA);
                    const participantBAvatar = getMemberAvatar(commitment.participantB);
                    const isUserParticipant = isParticipant(commitment);
                    const userIsA = isParticipantA(commitment);
                    const userCheckIns = userIsA ? commitment.participantACheckIns : commitment.participantBCheckIns;
                    const otherCheckIns = userIsA ? commitment.participantBCheckIns : commitment.participantACheckIns;

                    return (
                      <Card key={commitment.id}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-text text-lg font-display font-bold mb-2">
                                {commitment.commitmentName}
                              </h3>
                              <p className="text-accent text-sm font-mono">
                                Week {commitment.currentWeek + 1} of {commitment.durationWeeks}
                              </p>
                            </div>
                            {!commitment.accepted && (
                              <span className="px-3 py-1 border-2 border-secondary bg-secondary/10 text-secondary text-xs font-mono uppercase font-bold">
                                Pending
                              </span>
                            )}
                            {commitment.accepted && (
                              <span className="px-3 py-1 border-2 border-green-600 bg-green-600/10 text-green-600 text-xs font-mono uppercase font-bold">
                                Active
                              </span>
                            )}
                          </div>

                          {/* Participants */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-3 bg-surface border-2 border-text">
                              <div className="flex items-center gap-2 mb-2">
                                {participantAAvatar ? (
                                  <img src={participantAAvatar} alt={participantAName} className="w-8 h-8 rounded-full border-2 border-text" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-surface border-2 border-text flex items-center justify-center">
                                    <span className="material-symbols-outlined text-accent text-sm">person</span>
                                  </div>
                                )}
                                <span className="text-text font-mono font-bold text-sm">
                                  {participantAName}
                                  {userIsA && ' (You)'}
                                </span>
                              </div>
                              {commitment.accepted && (
                                <p className="text-accent text-xs font-mono">
                                  Check-ins: {commitment.participantACheckIns ?? 0} / {commitment.weeklyCheckInsRequired}
                                </p>
                              )}
                            </div>
                            <div className="p-3 bg-surface border-2 border-text">
                              <div className="flex items-center gap-2 mb-2">
                                {participantBAvatar ? (
                                  <img src={participantBAvatar} alt={participantBName} className="w-8 h-8 rounded-full border-2 border-text" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-surface border-2 border-text flex items-center justify-center">
                                    <span className="material-symbols-outlined text-accent text-sm">person</span>
                                  </div>
                                )}
                                <span className="text-text font-mono font-bold text-sm">
                                  {participantBName}
                                  {!userIsA && isUserParticipant && ' (You)'}
                                </span>
                              </div>
                              {commitment.accepted && (
                                <p className="text-accent text-xs font-mono">
                                  Check-ins: {commitment.participantBCheckIns ?? 0} / {commitment.weeklyCheckInsRequired}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="mb-4 p-3 bg-surface border-2 border-text">
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                              <div>
                                <span className="text-accent">Weekly Payout:</span>
                                <span className="text-text font-bold ml-2">
                                  ${(commitment.weeklyPayout / 1_000_000).toFixed(2)} USDC
                                </span>
                              </div>
                              <div>
                                <span className="text-accent">Required:</span>
                                <span className="text-text font-bold ml-2">
                                  {commitment.weeklyCheckInsRequired} check-ins/week
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            {canAccept(commitment) && (
                              <Button
                                onClick={() => handleAcceptCommitment(commitment.id)}
                                disabled={processing}
                                size="sm"
                              >
                                Accept Commitment
                              </Button>
                            )}
                            {canCheckIn(commitment) && (
                              <Button
                                onClick={() => handleCheckIn(commitment.id)}
                                disabled={processing}
                                variant="secondary"
                                size="sm"
                              >
                                <span className="material-symbols-outlined text-sm">check</span>
                                Check In ({userCheckIns ?? 0}/{commitment.weeklyCheckInsRequired})
                              </Button>
                            )}
                            {canProcessWeek(commitment) && (
                              <Button
                                onClick={() => handleProcessWeek(commitment.id, commitment.currentWeek)}
                                disabled={processing}
                                variant="secondary"
                                size="sm"
                              >
                                Process Week {commitment.currentWeek + 1}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* How It Works */}
              <div className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-text text-lg font-display font-bold mb-4">How It Works</h3>
                    <ol className="space-y-3 text-sm text-accent font-mono list-decimal list-inside">
                      <li>Create a commitment with another group member (e.g., "Gym 3x this week")</li>
                      <li>Both participants stake equal USDC amounts</li>
                      <li>Check in throughout the week to track progress</li>
                      <li>At week's end, the participant who met their goal wins the pool</li>
                      <li>If both succeed or both fail, the pool is split evenly</li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
