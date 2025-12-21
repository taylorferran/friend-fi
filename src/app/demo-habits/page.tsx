'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';
import { transferUSDCFromFaucet, aptos } from '@/lib/move-wallet';
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { 
  buildSetProfilePayload,
  buildCreateGroupPayload,
  buildJoinGroupPayload,
  buildCreateCommitmentPayload,
  buildAcceptCommitmentPayload,
  buildCheckInPayload,
  buildProcessWeekPayload,
  getGroupsCount,
  getCommitmentData,
} from '@/lib/contract';

// Faucet wallet private key
const FAUCET_PRIVATE_KEY = process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY || '';

type DemoStep = 
  | 'start'
  | 'user1-wallet'
  | 'user1-profile'
  | 'user1-fund'
  | 'user1-create-group'
  | 'user1-create-commitment'
  | 'user2-wallet'
  | 'user2-profile'
  | 'user2-fund'
  | 'user2-join-group'
  | 'user2-accept-commitment'
  | 'user1-checkin-1'
  | 'user1-checkin-2'
  | 'user1-checkin-3'
  | 'user2-checkin-1'
  | 'user2-checkin-2'
  | 'user1-process-week'
  | 'complete';

interface DemoUser {
  name: string;
  avatarId: number;
  address: string | null;
  privateKeyHex: string | null;
  balance: number;
  checkIns: number;
}

interface TransactionRecord {
  action: string;
  user: string;
  hash: string;
  timestamp: number;
}

// Helper to execute transactions with a demo wallet using Shinami sponsorship
async function executeDemoTransaction(
  walletData: { address: string; privateKeyHex: string },
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[] | number[])[];
  }
): Promise<{ hash: string; success: boolean }> {
  const privateKey = new Ed25519PrivateKey(walletData.privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });
  
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: payload,
    withFeePayer: true,
  });

  const senderAuthenticator = aptos.transaction.sign({
    signer: account,
    transaction,
  });

  const response = await fetch('/api/sponsor-transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: transaction.bcsToHex().toString(),
      senderAuth: senderAuthenticator.bcsToHex().toString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to sponsor transaction');
  }

  const result = await response.json();
  const txResponse = await aptos.waitForTransaction({
    transactionHash: result.pendingTx.hash,
  });

  return {
    hash: result.pendingTx.hash,
    success: txResponse.success,
  };
}

export default function HabitTrackerDemo() {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState<DemoStep>('start');
  const [processing, setProcessing] = useState(false);
  
  // Generate random usernames with 6-digit numbers
  const generateUsername = (baseName: string) => {
    const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit number
    return `${baseName}${randomNum}`;
  };
  
  // Demo users
  const [alice, setAlice] = useState<DemoUser>({
    name: generateUsername('Alice'),
    avatarId: 1,
    address: null,
    privateKeyHex: null,
    balance: 0,
    checkIns: 0,
  });
  
  const [bob, setBob] = useState<DemoUser>({
    name: generateUsername('Bob'),
    avatarId: 5,
    address: null,
    privateKeyHex: null,
    balance: 0,
    checkIns: 0,
  });

  // Demo state
  const [groupId, setGroupId] = useState<number | null>(null);
  const [commitmentId, setCommitmentId] = useState<number>(0);
  const [txHistory, setTxHistory] = useState<TransactionRecord[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnings, setWinnings] = useState<number>(0);

  const addTransaction = (action: string, user: string, hash: string) => {
    setTxHistory(prev => [...prev, { action, user, hash, timestamp: Date.now() }]);
  };

  const nextStep = async () => {
    if (processing) return;
    setProcessing(true);

    try {
      switch (currentStep) {
        case 'start':
          // Generate Alice's wallet
          const aliceAccount = Account.generate();
          setAlice(prev => ({
            ...prev,
            address: aliceAccount.accountAddress.toString(),
            privateKeyHex: aliceAccount.privateKey.toString(),
          }));
          setCurrentStep('user1-wallet');
          showToast({ type: 'success', title: `${alice.name}'s wallet created!` });
          break;

        case 'user1-wallet':
          // Set Alice's profile
          if (!alice.address || !alice.privateKeyHex) throw new Error('Alice wallet not ready');
          const aliceProfilePayload = buildSetProfilePayload(alice.name, alice.avatarId);
          const aliceProfileTx = await executeDemoTransaction(
            { address: alice.address, privateKeyHex: alice.privateKeyHex },
            aliceProfilePayload
          );
          addTransaction('Set profile', alice.name, aliceProfileTx.hash);
          setCurrentStep('user1-profile');
          showToast({ type: 'success', title: `${alice.name}'s profile set!` });
          break;

        case 'user1-profile':
          // Fund Alice with USDC (needs extra for 0.3% platform fee)
          if (!alice.address) throw new Error('Alice address not ready');
          const aliceFundTx = await transferUSDCFromFaucet(FAUCET_PRIVATE_KEY, alice.address, 0.15);
          if (aliceFundTx.success) {
            setAlice(prev => ({ ...prev, balance: 150000 }));
            addTransaction('Receive 0.15 USDC', alice.name, aliceFundTx.hash);
            setCurrentStep('user1-fund');
            showToast({ type: 'success', title: `${alice.name} funded with 0.15 USDC!` });
          }
          break;

        case 'user1-fund':
          // Alice creates group
          if (!alice.address || !alice.privateKeyHex) throw new Error('Alice wallet not ready');
          const groupsCount = await getGroupsCount();
          const createGroupPayload = buildCreateGroupPayload('Fitness Squad', 'gym123', 'Get fit together!');
          const createGroupTx = await executeDemoTransaction(
            { address: alice.address, privateKeyHex: alice.privateKeyHex },
            createGroupPayload
          );
          setGroupId(groupsCount);
          addTransaction('Create group', alice.name, createGroupTx.hash);
          setCurrentStep('user1-create-group');
          showToast({ type: 'success', title: 'Group "Fitness Squad" created!' });
          break;

        case 'user1-create-group':
          // Generate Bob's wallet first
          const bobAccount = Account.generate();
          setBob(prev => ({
            ...prev,
            address: bobAccount.accountAddress.toString(),
            privateKeyHex: bobAccount.privateKey.toString(),
          }));
          setCurrentStep('user2-wallet');
          showToast({ type: 'success', title: `${bob.name}'s wallet created!` });
          break;

        case 'user2-wallet':
          // Set Bob's profile
          if (!bob.address || !bob.privateKeyHex) throw new Error('Bob wallet not ready');
          const bobProfilePayload = buildSetProfilePayload(bob.name, bob.avatarId);
          const bobProfileTx = await executeDemoTransaction(
            { address: bob.address, privateKeyHex: bob.privateKeyHex },
            bobProfilePayload
          );
          addTransaction('Set profile', bob.name, bobProfileTx.hash);
          setCurrentStep('user2-profile');
          showToast({ type: 'success', title: `${bob.name}'s profile set!` });
          break;

        case 'user2-profile':
          // Fund Bob with USDC (needs extra for 0.3% platform fee)
          if (!bob.address) throw new Error('Bob address not ready');
          const bobFundTx = await transferUSDCFromFaucet(FAUCET_PRIVATE_KEY, bob.address, 0.15);
          if (bobFundTx.success) {
            setBob(prev => ({ ...prev, balance: 150000 }));
            addTransaction('Receive 0.15 USDC', bob.name, bobFundTx.hash);
            setCurrentStep('user2-fund');
            showToast({ type: 'success', title: `${bob.name} funded with 0.15 USDC!` });
          }
          break;

        case 'user2-fund':
          // Bob joins group FIRST before commitment is created
          if (!bob.address || !bob.privateKeyHex || groupId === null) throw new Error('Bob not ready to join');
          const joinGroupPayload = buildJoinGroupPayload(groupId, 'gym123');
          const joinGroupTx = await executeDemoTransaction(
            { address: bob.address, privateKeyHex: bob.privateKeyHex },
            joinGroupPayload
          );
          addTransaction('Join group', bob.name, joinGroupTx.hash);
          setCurrentStep('user2-join-group');
          showToast({ type: 'success', title: `${bob.name} joined the group!` });
          break;

        case 'user2-join-group':
          // NOW Alice creates habit commitment with Bob (both are in group)
          if (!alice.address || !alice.privateKeyHex || groupId === null || !bob.address) {
            throw new Error('Not ready to create commitment');
          }
          const createCommitmentPayload = buildCreateCommitmentPayload(
            groupId,
            bob.address,
            200000,  // 0.2 USDC total payout (0.1 per person)
            3,       // 3 check-ins required
            1,       // 1 week duration
            'Gym 3 times this week 💪'
          );
          const createCommitmentTx = await executeDemoTransaction(
            { address: alice.address, privateKeyHex: alice.privateKeyHex },
            createCommitmentPayload
          );
          setAlice(prev => ({ ...prev, balance: prev.balance - 100300 }));
          addTransaction('Create commitment (stake 0.1 USDC + 0.3% fee)', alice.name, createCommitmentTx.hash);
          setCurrentStep('user1-create-commitment');
          showToast({ type: 'success', title: 'Habit commitment created!' });
          break;

        case 'user1-create-commitment':
          // Bob accepts commitment
          if (!bob.address || !bob.privateKeyHex || groupId === null) throw new Error('Bob not ready to accept');
          const acceptPayload = buildAcceptCommitmentPayload(groupId, commitmentId);
          const acceptTx = await executeDemoTransaction(
            { address: bob.address, privateKeyHex: bob.privateKeyHex },
            acceptPayload
          );
          setBob(prev => ({ ...prev, balance: prev.balance - 100300 }));
          addTransaction('Accept commitment (stake 0.1 USDC + 0.3% fee)', bob.name, acceptTx.hash);
          setCurrentStep('user2-accept-commitment');
          showToast({ type: 'success', title: `${bob.name} accepted the commitment!` });
          break;

        case 'user2-accept-commitment':
          // Alice check-in #1
          if (!alice.address || !alice.privateKeyHex || groupId === null) throw new Error('Alice not ready to check-in');
          const aliceCheckIn1 = buildCheckInPayload(groupId, commitmentId);
          const aliceTx1 = await executeDemoTransaction(
            { address: alice.address, privateKeyHex: alice.privateKeyHex },
            aliceCheckIn1
          );
          setAlice(prev => ({ ...prev, checkIns: 1 }));
          addTransaction('Check-in #1', alice.name, aliceTx1.hash);
          setCurrentStep('user1-checkin-1');
          showToast({ type: 'success', title: `${alice.name} checked in! (1/3)` });
          break;

        case 'user1-checkin-1':
          // Alice check-in #2
          if (!alice.address || !alice.privateKeyHex || groupId === null) throw new Error('Alice not ready to check-in');
          const aliceCheckIn2 = buildCheckInPayload(groupId, commitmentId);
          const aliceTx2 = await executeDemoTransaction(
            { address: alice.address, privateKeyHex: alice.privateKeyHex },
            aliceCheckIn2
          );
          setAlice(prev => ({ ...prev, checkIns: 2 }));
          addTransaction('Check-in #2', alice.name, aliceTx2.hash);
          setCurrentStep('user1-checkin-2');
          showToast({ type: 'success', title: `${alice.name} checked in! (2/3)` });
          break;

        case 'user1-checkin-2':
          // Alice check-in #3
          if (!alice.address || !alice.privateKeyHex || groupId === null) throw new Error('Alice not ready to check-in');
          const aliceCheckIn3 = buildCheckInPayload(groupId, commitmentId);
          const aliceTx3 = await executeDemoTransaction(
            { address: alice.address, privateKeyHex: alice.privateKeyHex },
            aliceCheckIn3
          );
          setAlice(prev => ({ ...prev, checkIns: 3 }));
          addTransaction('Check-in #3 ✓', alice.name, aliceTx3.hash);
          setCurrentStep('user1-checkin-3');
          showToast({ type: 'success', title: `${alice.name} completed all check-ins! (3/3)` });
          break;

        case 'user1-checkin-3':
          // Bob check-in #1
          if (!bob.address || !bob.privateKeyHex || groupId === null) throw new Error('Bob not ready to check-in');
          const bobCheckIn1 = buildCheckInPayload(groupId, commitmentId);
          const bobTx1 = await executeDemoTransaction(
            { address: bob.address, privateKeyHex: bob.privateKeyHex },
            bobCheckIn1
          );
          setBob(prev => ({ ...prev, checkIns: 1 }));
          addTransaction('Check-in #1', bob.name, bobTx1.hash);
          setCurrentStep('user2-checkin-1');
          showToast({ type: 'success', title: `${bob.name} checked in! (1/3)` });
          break;

        case 'user2-checkin-1':
          // Bob check-in #2
          if (!bob.address || !bob.privateKeyHex || groupId === null) throw new Error('Bob not ready to check-in');
          const bobCheckIn2 = buildCheckInPayload(groupId, commitmentId);
          const bobTx2 = await executeDemoTransaction(
            { address: bob.address, privateKeyHex: bob.privateKeyHex },
            bobCheckIn2
          );
          setBob(prev => ({ ...prev, checkIns: 2 }));
          addTransaction('Check-in #2 (only 2/3)', bob.name, bobTx2.hash);
          setCurrentStep('user2-checkin-2');
          showToast({ type: 'info', title: `${bob.name} checked in! (2/3 - failed requirement)` });
          break;

        case 'user2-checkin-2':
          // Simulate week passing and processing (can't call on-chain due to time constraint)
          // In production, after 1 week, anyone can call process_week()
          
          // Calculate winnings: Alice met 3/3, Bob only 2/3
          // Total pool: 0.2 USDC (200,000 micro-USDC)
          // Alice wins the full 0.2 USDC
          const totalPool = 200000;
          
          setAlice(prev => ({ ...prev, balance: prev.balance + totalPool }));
          setWinner(alice.name);
          setWinnings(totalPool);
          addTransaction('⏱️ Week passes - Alice wins! (simulated)', alice.name, '0xsimulated');
          setCurrentStep('user1-process-week');
          showToast({ 
            type: 'success', 
            title: '⏱️ One week later...', 
            message: 'Alice met the goal, wins 0.2 USDC!' 
          });
          break;

        case 'user1-process-week':
          setCurrentStep('complete');
          showToast({ type: 'success', title: 'Demo complete!' });
          break;
      }
    } catch (error: any) {
      console.error('Demo step error:', error);
      showToast({ type: 'error', title: 'Transaction failed', message: error.message });
    } finally {
      setProcessing(false);
    }
  };

  const resetDemo = () => {
    setCurrentStep('start');
    setAlice({
      name: generateUsername('Alice'),
      avatarId: 1,
      address: null,
      privateKeyHex: null,
      balance: 0,
      checkIns: 0,
    });
    setBob({
      name: generateUsername('Bob'),
      avatarId: 5,
      address: null,
      privateKeyHex: null,
      balance: 0,
      checkIns: 0,
    });
    setGroupId(null);
    setCommitmentId(0);
    setTxHistory([]);
    setWinner(null);
    setWinnings(0);
  };

  const getStepDescription = (step: DemoStep): string => {
    const descriptions: Record<DemoStep, string> = {
      'start': 'Ready to start the habit tracker demo',
      'user1-wallet': 'Alice\'s wallet created',
      'user1-profile': 'Alice set her profile',
      'user1-fund': 'Alice funded with 0.1 USDC',
      'user1-create-group': 'Alice created "Fitness Squad" group',
      'user1-create-commitment': 'Alice created gym commitment (staked 0.1 USDC)',
      'user2-wallet': 'Bob\'s wallet created',
      'user2-profile': 'Bob set his profile',
      'user2-fund': 'Bob funded with 0.1 USDC',
      'user2-join-group': 'Bob joined the group',
      'user2-accept-commitment': 'Bob accepted commitment (staked 0.1 USDC)',
      'user1-checkin-1': 'Alice checked in (1/3)',
      'user1-checkin-2': 'Alice checked in (2/3)',
      'user1-checkin-3': 'Alice checked in (3/3) ✓',
      'user2-checkin-1': 'Bob checked in (1/3)',
      'user2-checkin-2': 'Bob checked in (2/3) - Failed!',
      'user1-process-week': '⏱️ Week passes - Alice wins!',
      'complete': 'Demo complete!',
    };
    return descriptions[step];
  };

  const isComplete = currentStep === 'complete';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-4 border-text bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Logo />
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-text">Habit Tracker Demo 💪</h1>
                <p className="text-accent font-mono text-xs sm:text-sm">Watch Alice and Bob create a gym commitment and compete!</p>
              </div>
            </div>
            <Link
              href="/demo-selector"
              className="flex items-center px-3 sm:px-4 py-2 border-2 border-text bg-surface hover:bg-primary transition-colors font-mono font-bold text-sm"
            >
              <span className="material-symbols-outlined text-sm mr-2">arrow_back</span>
              <span className="hidden sm:inline">All Demos</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Users */}
          <div className="space-y-4">
            {/* Alice Card */}
            <Card className={alice.address ? 'ring-2 ring-primary' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-surface flex items-center justify-center">
                    {alice.avatarId ? (
                      <img 
                        src={getAvatarUrl(AVATAR_OPTIONS[alice.avatarId].seed, AVATAR_OPTIONS[alice.avatarId].style)} 
                        alt={alice.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-accent">person</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-display font-bold text-text">{alice.name}</h3>
                    {alice.address && (
                      <p className="text-xs font-mono text-accent break-all">
                        {alice.address.slice(0, 6)}...{alice.address.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-accent">USDC Balance:</span>
                    <span className="font-mono font-bold text-primary">
                      {(alice.balance / 1_000_000).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-accent">Check-ins:</span>
                    <span className="font-mono font-bold text-text">
                      {alice.checkIns}/3 {alice.checkIns >= 3 && '✓'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bob Card */}
            <Card className={bob.address ? 'ring-2 ring-secondary' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-surface flex items-center justify-center">
                    {bob.avatarId ? (
                      <img 
                        src={getAvatarUrl(AVATAR_OPTIONS[bob.avatarId].seed, AVATAR_OPTIONS[bob.avatarId].style)} 
                        alt={bob.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-accent">person</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-display font-bold text-text">{bob.name}</h3>
                    {bob.address && (
                      <p className="text-xs font-mono text-accent break-all">
                        {bob.address.slice(0, 6)}...{bob.address.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-accent">USDC Balance:</span>
                    <span className="font-mono font-bold text-secondary">
                      {(bob.balance / 1_000_000).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-accent">Check-ins:</span>
                    <span className="font-mono font-bold text-text">
                      {bob.checkIns}/3 {bob.checkIns < 3 && bob.checkIns > 0 && '✗'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Commitment Info */}
            {groupId !== null && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-display font-bold text-text mb-3">
                    Commitment Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-accent">Group:</span>
                      <span className="text-text font-mono">Fitness Squad</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-accent">Challenge:</span>
                      <span className="text-text font-mono">Gym 3x/week</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-accent">Stakes:</span>
                      <span className="text-text font-mono">0.1 USDC each</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-accent">Total Pool:</span>
                      <span className="text-primary font-bold font-mono">0.2 USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-accent">Duration:</span>
                      <span className="text-text font-mono">1 week</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle Column - Progress & Actions */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-text mb-3 sm:mb-4">
                  Demo Progress
                </h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      currentStep !== 'start' ? 'bg-primary text-background' : 'bg-surface text-accent'
                    }`}>
                      {currentStep !== 'start' ? '✓' : '1'}
                    </div>
                    <span className="text-text">{getStepDescription(currentStep)}</span>
                  </div>
                </div>

                {!isComplete && (
                  <Button 
                    onClick={nextStep} 
                    disabled={processing} 
                    className="w-full"
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">arrow_forward</span>
                        Next Step
                      </>
                    )}
                  </Button>
                )}

                {isComplete && (
                  <div className="space-y-3">
                    <div className="bg-primary/10 rounded-lg p-4 text-center">
                      <span className="material-symbols-outlined text-5xl text-primary mb-2">
                        emoji_events
                      </span>
                      <h3 className="text-xl font-display font-bold text-primary mb-1">
                        {winner} Wins!
                      </h3>
                      <p className="text-2xl font-mono font-bold text-primary">
                        {(winnings / 1_000_000).toFixed(4)} USDC
                      </p>
                    </div>
                    <Button onClick={resetDemo} className="w-full" variant="secondary">
                      <span className="material-symbols-outlined">refresh</span>
                      Start Over
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How It Works */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-display font-bold text-text mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined">info</span>
                  How It Works
                </h3>
                <ol className="space-y-2 text-sm text-accent list-decimal list-inside">
                  <li>Alice creates group & habit commitment</li>
                  <li>Both stake 0.1 USDC (0.2 total pool)</li>
                  <li>Must check-in 3 times in 1 week</li>
                  <li>Alice completes (3/3) ✓</li>
                  <li>Bob fails (2/3) ✗</li>
                  <li>Alice wins entire pool minus 0.3% fee</li>
                </ol>
                <div className="mt-3 p-3 bg-surface border border-border rounded-lg">
                  <p className="text-xs text-accent">
                    <span className="font-bold text-primary">Note:</span> Final payout is simulated. 
                    In production, process_week() can be called after 1 week passes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Transaction History */}
          <div>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-display font-bold text-text mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">receipt_long</span>
                  Transaction History ({txHistory.length})
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {txHistory.length === 0 ? (
                    <p className="text-sm text-accent text-center py-4">
                      No transactions yet
                    </p>
                  ) : (
                    txHistory.map((tx, idx) => (
                      <div 
                        key={idx}
                        className="bg-surface rounded-lg p-3 border border-border hover:border-primary transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-text">
                            {tx.action}
                          </span>
                          <span className={`text-xs font-bold ${
                            tx.user === 'Alice' ? 'text-primary' : 'text-secondary'
                          }`}>
                            {tx.user}
                          </span>
                        </div>
                        <a
                          href={`https://explorer.movementnetwork.xyz/txn/${tx.hash}?network=custom`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-accent hover:text-primary transition-colors break-all"
                        >
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

