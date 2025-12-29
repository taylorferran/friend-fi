'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';
import { transferUSDCFromFaucet, aptos } from '@/lib/move-wallet';
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { 
  buildCreateCommitmentPayload,
  buildAcceptCommitmentPayload,
  buildCheckInPayload,
} from '@/lib/contract';
import { createGroupInSupabase, addGroupMember, upsertProfile } from '@/lib/supabase-services';
import { hashPassword } from '@/lib/crypto';

// Faucet wallet private key
const FAUCET_PRIVATE_KEY = process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY || '';

// Random data generators
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];

interface DemoUser {
  name: string;
  address: string;
  wallet: Account;
  walletData: { address: string; privateKeyHex: string };
  avatarId: number;
  checkIns: number;
}

interface TransactionRecord {
  user: string;
  action: string;
  hash: string;
  status: 'pending' | 'success' | 'error';
  timestamp: number;
}

type DemoPhase = 
  | 'idle'
  | 'setup-users'
  | 'create-group'
  | 'create-commitment'
  | 'check-ins'
  | 'complete';

function generateRandomName(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const uniqueId = Math.floor(100000 + Math.random() * 900000);
  return `${firstName}${uniqueId}`;
}

export default function DemoHabitsPage() {
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [processing, setProcessing] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  
  const [alice, setAlice] = useState<DemoUser | null>(null);
  const [bob, setBob] = useState<DemoUser | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [commitmentId] = useState<number>(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnings, setWinnings] = useState<number>(0);
  
  const [txHistory, setTxHistory] = useState<TransactionRecord[]>([]);

  const recordTx = (user: string, action: string, hash: string, status: 'pending' | 'success' | 'error' = 'pending') => {
    setTxHistory(prev => [...prev, { user, action, hash, status, timestamp: Date.now() }]);
  };

  const updateTxStatus = (hash: string, status: 'success' | 'error') => {
    setTxHistory(prev => prev.map(tx => 
      tx.hash === hash ? { ...tx, status } : tx
    ));
  };

  const executeDemoTransaction = async (
    walletData: { address: string; privateKeyHex: string },
    payload: any,
    description: string,
    userName: string
  ): Promise<string> => {
    const tempHash = `pending-${Date.now()}`;
    recordTx(userName, description, tempHash, 'pending');
    
    try {
      const privateKey = new Ed25519PrivateKey(walletData.privateKeyHex);
      const account = Account.fromPrivateKey({ privateKey });
      
      let transaction;
      let retries = 5;
      
      while (retries > 0) {
        try {
          transaction = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            data: payload,
            withFeePayer: true,
          });
          break;
        } catch (error: any) {
          if (error.message?.includes('Account not found') && retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
          } else {
            throw error;
          }
        }
      }

      if (!transaction) {
        throw new Error('Failed to build transaction after retries');
      }

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
      const pendingTxHash = result.pendingTx.hash;

      setTxHistory(prev => prev.map(tx => 
        tx.hash === tempHash ? { ...tx, hash: pendingTxHash } : tx
      ));

      const txResponse = await aptos.waitForTransaction({
        transactionHash: pendingTxHash,
      });

      if (!txResponse.success) {
        updateTxStatus(pendingTxHash, 'error');
        throw new Error(`Transaction failed: ${description}`);
      }

      updateTxStatus(pendingTxHash, 'success');
      return pendingTxHash;
    } catch (error) {
      updateTxStatus(tempHash, 'error');
      throw error;
    }
  };

  const runFullDemo = async () => {
    setProcessing(true);
    setTxHistory([]);
    
    try {
      // Phase 1: Setup Users
      setPhase('setup-users');
      setCurrentAction('Creating Alice and Bob...');
      
      // Create Alice
      const aliceWallet = Account.generate();
      const aliceName = generateRandomName();
      const aliceAvatar = 1;
      
      const aliceUser: DemoUser = {
        name: aliceName,
        address: aliceWallet.accountAddress.toString(),
        wallet: aliceWallet,
        walletData: {
          address: aliceWallet.accountAddress.toString(),
          privateKeyHex: aliceWallet.privateKey.toString(),
        },
        avatarId: aliceAvatar,
        checkIns: 0,
      };
      setAlice(aliceUser);
      
      // Fund Alice
      setCurrentAction(`Funding ${aliceName}...`);
      const aliceFundResult = await transferUSDCFromFaucet(
        FAUCET_PRIVATE_KEY,
        aliceUser.address,
        0.05  // Increased from 0.0375 to ensure enough for commitment + fees
      );
      
      if (!aliceFundResult.success) {
        throw new Error('Failed to fund Alice');
      }
      
      recordTx(aliceName, 'Funded 0.05 USDC', aliceFundResult.hash, 'success');
      
      // Set Alice's profile
      await upsertProfile(aliceUser.address, aliceName, aliceAvatar);
      recordTx(aliceName, 'Set Profile (Supabase)', 'supabase-profile', 'success');
      
      // Create Bob
      const bobWallet = Account.generate();
      const bobName = generateRandomName();
      const bobAvatar = 5;
      
      const bobUser: DemoUser = {
        name: bobName,
        address: bobWallet.accountAddress.toString(),
        wallet: bobWallet,
        walletData: {
          address: bobWallet.accountAddress.toString(),
          privateKeyHex: bobWallet.privateKey.toString(),
        },
        avatarId: bobAvatar,
        checkIns: 0,
      };
      setBob(bobUser);
      
      // Fund Bob
      setCurrentAction(`Funding ${bobName}...`);
      const bobFundResult = await transferUSDCFromFaucet(
        FAUCET_PRIVATE_KEY,
        bobUser.address,
        0.05  // Increased from 0.0375 to ensure enough for commitment + fees
      );
      
      if (!bobFundResult.success) {
        throw new Error('Failed to fund Bob');
      }
      
      recordTx(bobName, 'Funded 0.05 USDC', bobFundResult.hash, 'success');
      
      // Set Bob's profile
      await upsertProfile(bobUser.address, bobName, bobAvatar);
      recordTx(bobName, 'Set Profile (Supabase)', 'supabase-profile', 'success');
      
      // Phase 2: Create Group
      setPhase('create-group');
      setCurrentAction('Creating Fitness Squad group...');
      
      const passwordHash = await hashPassword('demo123');
      const group = await createGroupInSupabase(
        'Fitness Squad',
        'Speed demo habit tracking group',
        passwordHash,
        aliceUser.address
      );
      const newGroupId = group.id;
      setGroupId(newGroupId);
      recordTx(aliceName, 'Create Group (Supabase)', 'supabase-group', 'success');
      
      // Add Bob to group (Alice was auto-added as creator)
      await addGroupMember(newGroupId, bobUser.address);
      recordTx(bobName, 'Join Group (Supabase)', 'supabase-join', 'success');
      
      // Wait longer for group membership to fully propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Phase 3: Create Commitment
      setPhase('create-commitment');
      setCurrentAction('Alice creating gym commitment...');
      
      // Request membership signature for Alice
      const aliceSignatureResponse = await fetch(`/api/groups/${newGroupId}/membership-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: aliceUser.address }),
      });
      
      if (!aliceSignatureResponse.ok) {
        const error = await aliceSignatureResponse.json();
        throw new Error(`Failed to get Alice's signature: ${error.error || 'Unknown error'}`);
      }
      
      const aliceProof = await aliceSignatureResponse.json();
      
      const createCommitmentPayload = buildCreateCommitmentPayload(
        newGroupId,
        aliceProof.signature,
        aliceProof.expiresAt,
        bobUser.address,
        50000,  // 0.05 USDC total payout
        3,      // 3 check-ins required
        1,      // 1 week duration
        'Gym 3 times this week'
      );
      
      await executeDemoTransaction(
        aliceUser.walletData,
        createCommitmentPayload,
        'Create commitment (stake 0.025 USDC + fee)',
        aliceName
      );
      
      // Bob accepts commitment
      setCurrentAction('Bob accepting commitment...');
      
      // Request membership signature for Bob
      const bobSignatureResponse = await fetch(`/api/groups/${newGroupId}/membership-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: bobUser.address }),
      });
      
      if (!bobSignatureResponse.ok) {
        const error = await bobSignatureResponse.json();
        throw new Error(`Failed to get Bob's signature: ${error.error || 'Unknown error'}`);
      }
      
      const bobProof = await bobSignatureResponse.json();
      
      const acceptPayload = buildAcceptCommitmentPayload(
        newGroupId,
        bobProof.signature,
        bobProof.expiresAt,
        commitmentId
      );
      
      await executeDemoTransaction(
        bobUser.walletData,
        acceptPayload,
        'Accept commitment (stake 0.025 USDC + fee)',
        bobName
      );
      
      // Phase 4: Check-ins
      setPhase('check-ins');
      
      // Alice check-ins (3/3)
      for (let i = 1; i <= 3; i++) {
        setCurrentAction(`Alice check-in ${i}/3...`);
        const checkInPayload = buildCheckInPayload(newGroupId, commitmentId);
        await executeDemoTransaction(
          aliceUser.walletData,
          checkInPayload,
          `Check-in #${i}${i === 3 ? ' ✓' : ''}`,
          aliceName
        );
        setAlice(prev => prev ? { ...prev, checkIns: i } : null);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Bob check-ins (only 2/3)
      for (let i = 1; i <= 2; i++) {
        setCurrentAction(`Bob check-in ${i}/3...`);
        const checkInPayload = buildCheckInPayload(newGroupId, commitmentId);
        await executeDemoTransaction(
          bobUser.walletData,
          checkInPayload,
          `Check-in #${i} (only 2/3)`,
          bobName
        );
        setBob(prev => prev ? { ...prev, checkIns: i } : null);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Phase 5: Simulate week passing
      setCurrentAction('⏱️ One week later...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Alice wins (met 3/3 requirement)
      const totalPool = 50000; // 0.05 USDC
      setWinner(aliceName);
      setWinnings(totalPool);
      recordTx(aliceName, '⏱️ Week passes - Alice wins! (simulated)', '0xsimulated', 'success');
      
      setPhase('complete');
      setCurrentAction('Demo complete!');
      
    } catch (error: any) {
      console.error('Demo error:', error);
      setCurrentAction(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setPhase('idle');
    setCurrentAction('');
    setAlice(null);
    setBob(null);
    setGroupId(null);
    setWinner(null);
    setWinnings(0);
    setTxHistory([]);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-4 border-text bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo />
              <div>
                <h1 className="text-3xl font-display font-bold text-text">Habit Tracker Speed Demo 💪</h1>
                <p className="text-accent font-mono text-sm">Watch the full flow in action</p>
              </div>
            </div>
            <Link
              href="/demo-selector"
              className="flex items-center px-4 py-2 border-2 border-text bg-surface hover:bg-primary transition-colors font-mono font-bold"
            >
              <span className="material-symbols-outlined text-sm mr-2">arrow_back</span>
              All Demos
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Current Action & Live Transaction Feed */}
        {phase !== 'idle' && phase !== 'complete' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Current Action */}
            <Card className="border-4 border-primary">
              <CardContent>
                <div className="flex items-center gap-3 mb-2">
                  <div className="animate-spin">
                    <span className="material-symbols-outlined text-primary text-3xl">progress_activity</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-text">{currentAction}</h2>
                    <p className="text-sm font-mono text-accent">Phase: {phase.replace(/-/g, ' ').toUpperCase()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Transaction Feed */}
            <Card className="border-4 border-text">
              <CardContent>
                <h3 className="text-text font-display font-bold mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined">receipt_long</span>
                  Live Transactions ({txHistory.length})
                </h3>
                <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {txHistory.slice().reverse().map((tx, idx) => (
                    <div
                      key={idx}
                      className={`
                        flex items-center gap-2 p-2 border-2 text-xs font-mono
                        ${tx.status === 'pending' ? 'border-primary bg-primary/10 animate-pulse' : ''}
                        ${tx.status === 'success' ? 'border-green-600 bg-green-600/10' : ''}
                        ${tx.status === 'error' ? 'border-secondary bg-secondary/10' : ''}
                      `}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {tx.status === 'pending' && 'hourglass_empty'}
                        {tx.status === 'success' && 'check_circle'}
                        {tx.status === 'error' && 'error'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-text truncate">{tx.user}</div>
                        <div className="text-accent truncate">{tx.action}</div>
                      </div>
                    </div>
                  ))}
                  {txHistory.length === 0 && (
                    <div className="text-center py-4 text-accent font-mono text-xs">
                      Waiting for transactions...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Start Screen */}
        {phase === 'idle' && (
          <Card className="max-w-2xl mx-auto">
            <CardContent>
              <div className="text-center space-y-6">
                <div className="text-8xl">⚡</div>
                <div>
                  <h2 className="text-3xl font-display font-bold text-text mb-2">Speed Demo</h2>
                  <p className="text-accent font-mono">
                    Watch a complete habit tracking cycle in seconds
                  </p>
                </div>
                
                <div className="text-left p-6 border-2 border-text bg-surface">
                  <h3 className="font-display font-bold text-text mb-3">What happens:</h3>
                  <ol className="space-y-2 font-mono text-sm text-accent list-decimal list-inside">
                    <li>Alice & Bob created with wallets</li>
                    <li>Both funded with 0.05 USDC from faucet</li>
                    <li>Group created and members added</li>
                    <li>Alice creates gym commitment (0.025 USDC stake)</li>
                    <li>Bob accepts commitment (0.025 USDC stake)</li>
                    <li>Alice checks in 3/3 times ✓</li>
                    <li>Bob checks in only 2/3 times ✗</li>
                    <li>Alice wins the pool (0.05 USDC)</li>
                  </ol>
                </div>

                <Button onClick={runFullDemo} disabled={processing} className="w-full" size="lg">
                  <span className="material-symbols-outlined">play_arrow</span>
                  Run Speed Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Screen */}
        {phase === 'complete' && alice && bob && (
          <Card className="max-w-4xl mx-auto">
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-8xl mb-4">🎉</div>
                  <h2 className="text-3xl font-display font-bold text-text mb-2">Demo Complete!</h2>
                  <p className="text-accent font-mono">Full habit tracking cycle completed on-chain</p>
                </div>

                {/* Winner Section */}
                <div className="bg-primary/10 rounded-lg p-6 text-center border-4 border-primary">
                  <span className="material-symbols-outlined text-5xl text-primary mb-2 block">
                    emoji_events
                  </span>
                  <h3 className="text-2xl font-display font-bold text-primary mb-1">
                    {winner} Wins!
                  </h3>
                  <p className="text-3xl font-mono font-bold text-primary">
                    {(winnings / 1_000_000).toFixed(4)} USDC
                  </p>
                </div>

                {/* Commitment Summary */}
                <div>
                  <h3 className="text-text text-xl font-display font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">fitness_center</span>
                    Commitment Details
                  </h3>
                  <div className="p-4 border-2 border-text bg-surface">
                    <div className="space-y-2 text-sm font-mono">
                      <div className="flex justify-between">
                        <span className="text-accent">Challenge:</span>
                        <span className="text-text">Gym 3 times this week</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-accent">Duration:</span>
                        <span className="text-text">1 week</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-accent">Stakes:</span>
                        <span className="text-text">0.025 USDC each</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-accent">Total Pool:</span>
                        <span className="text-primary font-bold">0.05 USDC</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border-2 border-green-600 bg-green-600/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-green-600">check_circle</span>
                      <span className="font-mono font-bold text-green-600">{alice.name}</span>
                    </div>
                    <p className="text-sm font-mono text-accent mb-1">Check-ins: 3/3 ✓</p>
                    <p className="text-xs font-mono text-accent">Completed requirement</p>
                  </div>
                  <div className="p-4 border-2 border-secondary bg-secondary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-secondary">cancel</span>
                      <span className="font-mono font-bold text-secondary">{bob.name}</span>
                    </div>
                    <p className="text-sm font-mono text-accent mb-1">Check-ins: 2/3 ✗</p>
                    <p className="text-xs font-mono text-accent">Failed requirement</p>
                  </div>
                </div>

                {/* Fee Information */}
                <div className="p-4 border-2 border-primary bg-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary">account_balance</span>
                    <span className="font-mono font-bold text-primary">Platform Fee</span>
                  </div>
                  <p className="text-sm font-mono text-accent">
                    0.3% fee collected on commitment creation to cover gas and operations
                  </p>
                </div>

                {/* Transaction History */}
                <div>
                  <h3 className="text-text text-xl font-display font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">history</span>
                    Transaction History ({txHistory.length} transactions)
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {txHistory.map((tx, idx) => (
                      <a
                        key={idx}
                        href={tx.hash.startsWith('pending-') || tx.hash.startsWith('supabase-') || tx.hash.startsWith('0xsimulated') ? '#' : `https://explorer.movementnetwork.xyz/txn/${tx.hash}?network=testnet`}
                        target={tx.hash.startsWith('pending-') || tx.hash.startsWith('supabase-') || tx.hash.startsWith('0xsimulated') ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className={`
                          block p-3 border-2 transition-colors
                          ${tx.status === 'success' ? 'border-green-600 bg-green-600/5 hover:bg-green-600/10' : ''}
                          ${tx.status === 'error' ? 'border-secondary bg-secondary/5' : ''}
                          ${tx.status === 'pending' ? 'border-primary bg-primary/5' : ''}
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="material-symbols-outlined text-sm">
                                {tx.status === 'success' && 'check_circle'}
                                {tx.status === 'error' && 'error'}
                                {tx.status === 'pending' && 'hourglass_empty'}
                              </span>
                              <div className="font-mono text-sm font-bold text-text">{tx.action}</div>
                            </div>
                            <div className="font-mono text-xs text-accent">{tx.user}</div>
                          </div>
                          {!tx.hash.startsWith('pending-') && !tx.hash.startsWith('supabase-') && !tx.hash.startsWith('0xsimulated') && (
                            <span className="material-symbols-outlined text-text text-sm">open_in_new</span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                <Button onClick={reset} className="w-full">
                  <span className="material-symbols-outlined">refresh</span>
                  Run Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
