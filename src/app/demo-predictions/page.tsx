'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';
import { transferUSDCFromFaucet, aptos } from '@/lib/move-wallet';
import { Account, Ed25519PrivateKey, AccountAddress } from "@aptos-labs/ts-sdk";
import { 
  buildCreateBetPayload,
  buildPlaceWagerPayload,
  buildResolveBetPayload,
  getBetData,
  getBetOutcomesLength,
  getBetOutcome,
  getBetOutcomePool,
  getWinningOutcome,
  PREDICTION_MODULE,
  getFunctionId
} from '@/lib/contract';
import { createGroupInSupabase, addGroupMember, upsertProfile } from '@/lib/supabase-services';
import { hashPassword } from '@/lib/crypto';

// Faucet wallet private key
const FAUCET_PRIVATE_KEY = process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY || '';

// Random data generators
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
const BET_TOPICS = [
  'Will Bitcoin reach $100k by end of month?',
  'Will it rain tomorrow?',
  'Will the home team win?',
  'Will the event sell out?',
  'Will the project launch on time?'
];

interface DemoUser {
  name: string;
  address: string;
  wallet: Account;
  walletData: { address: string; privateKeyHex: string };
  avatarId: number;
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
  | 'setup-admin'
  | 'create-group'
  | 'create-bet'
  | 'setup-users'
  | 'users-join-vote'
  | 'settle-bet'
  | 'complete';

export default function DemoPredictionsPage() {
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [processing, setProcessing] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  
  const [adminUser, setAdminUser] = useState<DemoUser | null>(null);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [betId, setBetId] = useState<number | null>(null);
  const [betTopic, setBetTopic] = useState('');
  const [groupName, setGroupName] = useState('');
  
  const [txHistory, setTxHistory] = useState<TransactionRecord[]>([]);
  const [betResults, setBetResults] = useState<{
    totalPool: number;
    yesPool: number;
    noPool: number;
    winningOutcome: number;
    winners: string[];
    payouts: { user: string; amount: number }[];
    feeCollected: number;
  } | null>(null);

  const recordTx = (user: string, action: string, hash: string, status: 'pending' | 'success' | 'error' = 'pending') => {
    setTxHistory(prev => [...prev, { user, action, hash, status, timestamp: Date.now() }]);
  };

  const updateTxStatus = (hash: string, status: 'success' | 'error') => {
    setTxHistory(prev => prev.map(tx => 
      tx.hash === hash ? { ...tx, status } : tx
    ));
  };

  const generateRandomName = () => {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${firstName}${randomNum}`;
  };

  const executeDemoTransaction = async (
    walletData: { address: string; privateKeyHex: string },
    payload: any,
    description: string,
    userName: string
  ): Promise<string> => {
    // Record pending transaction
    const tempHash = `pending-${Date.now()}`;
    recordTx(userName, description, tempHash, 'pending');
    
    try {
      const privateKey = new Ed25519PrivateKey(walletData.privateKeyHex);
      const account = Account.fromPrivateKey({ privateKey });
      
      // Retry building the transaction up to 5 times if account not found
      let transaction;
      let retries = 5;
      
      while (retries > 0) {
        try {
          transaction = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            data: payload,
            withFeePayer: true, // Use Shinami gas sponsorship
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          if (error.message?.includes('Account not found') && retries > 1) {
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
          } else {
            throw error; // Not an account error or out of retries
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

      // Use Shinami sponsorship
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

      // Update with real hash
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
      // Phase 1: Setup Admin User
      setPhase('setup-admin');
      setCurrentAction('Creating admin user wallet...');
      
      const adminWallet = Account.generate();
      const adminName = generateRandomName();
      const adminAvatar = Math.floor(Math.random() * AVATAR_OPTIONS.length);
      
      const admin: DemoUser = {
        name: adminName,
        address: adminWallet.accountAddress.toString(),
        wallet: adminWallet,
        walletData: {
          address: adminWallet.accountAddress.toString(),
          privateKeyHex: adminWallet.privateKey.toString(),
        },
        avatarId: adminAvatar,
      };
      setAdminUser(admin);
      
      // Fund admin with 0.05 USDC
      setCurrentAction('Funding admin with 0.05 USDC...');
      const fundResult = await transferUSDCFromFaucet(
        FAUCET_PRIVATE_KEY,
        admin.address,
        0.05
      );
      
      if (!fundResult.success) {
        throw new Error('Failed to fund admin account');
      }
      
      recordTx(admin.name, 'Funded 0.05 USDC', fundResult.hash, 'success');
      
      // Small delay to ensure account state is propagated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set profile in Supabase (off-chain, instant, no gas)
      setCurrentAction('Setting admin profile...');
      await upsertProfile(admin.address, admin.name, admin.avatarId);
      recordTx(admin.name, 'Set Profile (Supabase)', 'supabase-profile', 'success');
      
      // Phase 2: Create Group (off-chain in Supabase)
      setPhase('create-group');
      setCurrentAction('Creating prediction group...');
      
      const randomGroupName = `Predictions ${Math.floor(Math.random() * 10000)}`;
      setGroupName(randomGroupName);
      const groupPassword = 'demo123';
      const passwordHash = await hashPassword(groupPassword);
      
      const newGroup = await createGroupInSupabase(
        randomGroupName,
        'Speed demo prediction group',
        passwordHash,
        admin.address
      );
      const newGroupId = newGroup.id;
      setGroupId(newGroupId);
      recordTx(admin.name, 'Create Group (Supabase)', 'supabase-group', 'success');
      
      // Phase 3: Create Bet (with signature)
      setPhase('create-bet');
      setCurrentAction('Creating prediction bet...');
      
      const randomTopic = BET_TOPICS[Math.floor(Math.random() * BET_TOPICS.length)];
      setBetTopic(randomTopic);
      
      // Request membership signature for admin
      const membershipResponse = await fetch(`/api/groups/${newGroupId}/membership-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: admin.address }),
      });
      
      if (!membershipResponse.ok) {
        const error = await membershipResponse.json();
        throw new Error(`Failed to get membership proof: ${error.error || 'Unknown error'}`);
      }
      
      const membershipProof = await membershipResponse.json();
      
      const betPayload = buildCreateBetPayload(
        newGroupId,
        membershipProof.signature,
        membershipProof.expiresAt,
        randomTopic,
        ['Yes', 'No'],
        admin.address,
        []
      );
      const betHash = await executeDemoTransaction(
        admin.walletData,
        betPayload,
        'Create Bet',
        admin.name
      );
      
      // Get bet ID from events
      await new Promise(resolve => setTimeout(resolve, 1000));
      const betTx = await aptos.getTransactionByHash({ transactionHash: betHash });
      const betEvents = (betTx as any).events || [];
      const betCreatedEvent = betEvents.find((e: any) => 
        e.type.includes('::BetCreatedEvent')
      );
      const newBetId = betCreatedEvent?.data?.bet_id 
        ? parseInt(betCreatedEvent.data.bet_id) 
        : 0;
      setBetId(newBetId);
      
      // Admin places wager (95% of 0.05 USDC = 0.0475 USDC = 47,500 micro-USDC)
      setCurrentAction('Admin placing wager on Yes...');
      
      // Request fresh signature for wager
      const wagerResponse = await fetch(`/api/groups/${newGroupId}/membership-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: admin.address }),
      });
      
      if (!wagerResponse.ok) {
        const error = await wagerResponse.json();
        throw new Error(`Failed to get wager proof: ${error.error || 'Unknown error'}`);
      }
      
      const wagerProof = await wagerResponse.json();
      
      const adminWagerPayload = buildPlaceWagerPayload(
        newBetId,
        0,
        47500,
        wagerProof.signature,
        wagerProof.expiresAt
      );
      await executeDemoTransaction(
        admin.walletData,
        adminWagerPayload,
        'Wager 0.0475 USDC on Yes',
        admin.name
      );
      
      // Phase 4: Setup Other Users
      setPhase('setup-users');
      setCurrentAction('Creating 6 more users...');
      
      const newUsers: DemoUser[] = [];
      for (let i = 0; i < 6; i++) {
        const wallet = Account.generate();
        const name = generateRandomName();
        const avatar = Math.floor(Math.random() * AVATAR_OPTIONS.length);
        
        const user: DemoUser = {
          name,
          address: wallet.accountAddress.toString(),
          wallet,
          walletData: {
            address: wallet.accountAddress.toString(),
            privateKeyHex: wallet.privateKey.toString(),
          },
          avatarId: avatar,
        };
        newUsers.push(user);
        
        setCurrentAction(`Creating ${name}...`);
        
        // Fund user with 0.05 USDC
        const fundResult = await transferUSDCFromFaucet(
          FAUCET_PRIVATE_KEY,
          user.address,
          0.05
        );
        
        if (!fundResult.success) {
          throw new Error(`Failed to fund ${name}'s account`);
        }
        
        recordTx(user.name, 'Funded 0.05 USDC', fundResult.hash, 'success');
        
        // Small delay to ensure account state is propagated
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set profile in Supabase
        await upsertProfile(user.address, user.name, user.avatarId);
        recordTx(user.name, 'Set Profile (Supabase)', 'supabase-profile', 'success');
      }
      setUsers(newUsers);
      
      // Phase 5: Users Join and Vote (in parallel)
      setPhase('users-join-vote');
      setCurrentAction('Users joining group and casting votes...');
      
      const joinAndVotePromises = newUsers.map(async (user, idx) => {
        // Join group in Supabase (off-chain, instant)
        await addGroupMember(newGroupId, user.address);
        recordTx(user.name, 'Join Group (Supabase)', 'supabase-join', 'success');
        
        // Wait longer to ensure Supabase membership is fully propagated
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Vote: first 3 vote Yes (0), last 3 vote No (1) - 95% of 0.05 = 0.0475 USDC = 47,500 micro-USDC
        const outcome = idx < 3 ? 0 : 1;
        const outcomeName = outcome === 0 ? 'Yes' : 'No';
        
        // Request membership signature with retry logic
        let voteProof;
        let retries = 3;
        while (retries > 0) {
          try {
            const voteResponse = await fetch(`/api/groups/${newGroupId}/membership-proof`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress: user.address }),
            });
            
            if (!voteResponse.ok) {
              const error = await voteResponse.json();
              throw new Error(`Failed to get vote proof for ${user.name}: ${error.error || 'Unknown error'}`);
            }
            
            voteProof = await voteResponse.json();
            break; // Success, exit retry loop
          } catch (error) {
            retries--;
            if (retries === 0) throw error;
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        const wagerPayload = buildPlaceWagerPayload(
          newBetId,
          outcome,
          47500,
          voteProof.signature,
          voteProof.expiresAt
        );
        await executeDemoTransaction(
          user.walletData,
          wagerPayload,
          `Wager 0.0475 USDC on ${outcomeName}`,
          user.name
        );
      });
      
      await Promise.all(joinAndVotePromises);
      
      // Phase 6: Settle Bet
      setPhase('settle-bet');
      setCurrentAction('Admin settling bet...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Admin resolves bet (let's say Yes wins)
      const resolvePayload = buildResolveBetPayload(newBetId, 0); // 0 = Yes
      await executeDemoTransaction(
        admin.walletData,
        resolvePayload,
        'Resolve Bet (Yes wins)',
        admin.name
      );
      
      // Phase 7: Fetch Results
      setCurrentAction('Calculating results...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const betData = await getBetData(newBetId);
      const yesPool = await getBetOutcomePool(newBetId, 0);
      const noPool = await getBetOutcomePool(newBetId, 1);
      const totalPool = yesPool + noPool;
      const winningOutcome = await getWinningOutcome(newBetId);
      
      // Calculate winners and payouts
      const allUsers = [admin, ...newUsers];
      const winners = allUsers.filter((_, idx) => {
        if (idx === 0) return true; // admin voted yes
        if (idx === 1 || idx === 2 || idx === 3) return true; // first 3 users voted yes
        return false;
      });
      
      // Calculate fee (rake from contract)
      const feePercentage = 0.003; // 0.3% based on contract (3/1000)
      const feeCollected = Math.floor(totalPool * feePercentage);
      const netPool = totalPool - feeCollected;
      
      // Calculate payouts (proportional to wager) - all winners wagered 47,500
      const winnerWagers = [47500, 47500, 47500, 47500]; // admin + 3 users
      const totalWinnerWagers = winnerWagers.reduce((a, b) => a + b, 0);
      const payouts = winners.map((winner, idx) => ({
        user: winner.name,
        amount: Math.floor((winnerWagers[idx] / totalWinnerWagers) * netPool),
      }));
      
      setBetResults({
        totalPool,
        yesPool,
        noPool,
        winningOutcome,
        winners: winners.map(w => w.name),
        payouts,
        feeCollected,
      });
      
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
    setAdminUser(null);
    setUsers([]);
    setGroupId(null);
    setBetId(null);
    setBetTopic('');
    setGroupName('');
    setTxHistory([]);
    setBetResults(null);
  };

  return (
    <div className="min-h-screen bg-background mobile-content">
      {/* Header */}
      <div className="border-b-4 border-text bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo />
              <div>
                <h1 className="text-3xl font-display font-bold text-text">Prediction Market Speed Demo</h1>
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
                    Watch a complete prediction market cycle in seconds
                  </p>
                </div>
                
                <div className="text-left p-6 border-2 border-text bg-surface">
                  <h3 className="font-display font-bold text-text mb-3">What happens:</h3>
                  <ol className="space-y-2 font-mono text-sm text-accent list-decimal list-inside">
                    <li>Admin creates wallet, profile, group, and bet</li>
                    <li>6 users created with random names</li>
                    <li>All funded with 0.05 USDC from faucet</li>
                    <li>Each user bets 95% (0.0475 USDC) - 3 Yes, 3 No</li>
                    <li>Admin settles bet</li>
                    <li>Winners paid out proportionally</li>
                    <li>0.3% platform fee collected</li>
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
        {phase === 'complete' && betResults && (
          <Card className="max-w-4xl mx-auto">
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-8xl mb-4">🎉</div>
                  <h2 className="text-3xl font-display font-bold text-text mb-2">Demo Complete!</h2>
                  <p className="text-accent font-mono">Full prediction market cycle completed on-chain</p>
                </div>

                {/* Bet Summary */}
                <div>
                  <h3 className="text-text text-xl font-display font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">casino</span>
                    Bet Results
                  </h3>
                  <div className="p-4 border-2 border-text bg-surface">
                    <div className="font-mono text-sm text-text mb-3">
                      <span className="font-bold">Topic:</span> {betTopic}
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 border-2 border-text bg-background">
                        <div className="text-2xl font-display font-bold text-primary">
                          ${(betResults.totalPool / 1_000_000).toFixed(3)}
                        </div>
                        <div className="text-xs font-mono text-accent">Total Pool</div>
                      </div>
                      <div className="text-center p-3 border-2 border-text bg-background">
                        <div className="text-2xl font-display font-bold text-green-600">
                          ${(betResults.yesPool / 1_000_000).toFixed(3)}
                        </div>
                        <div className="text-xs font-mono text-accent">Yes Pool</div>
                      </div>
                      <div className="text-center p-3 border-2 border-text bg-background">
                        <div className="text-2xl font-display font-bold text-secondary">
                          ${(betResults.noPool / 1_000_000).toFixed(3)}
                        </div>
                        <div className="text-xs font-mono text-accent">No Pool</div>
                      </div>
                    </div>
                    <div className="p-3 border-2 border-green-600 bg-green-600/10 text-center">
                      <span className="font-mono font-bold text-green-600">
                        Winning Outcome: {betResults.winningOutcome === 0 ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payouts */}
                <div>
                  <h3 className="text-text text-xl font-display font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">payments</span>
                    Winner Payouts
                  </h3>
                  <div className="space-y-2">
                    {betResults.payouts.map((payout, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 border-2 border-text bg-green-600/10">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-green-600">emoji_events</span>
                          <span className="font-mono font-bold text-text">{payout.user}</span>
                        </div>
                        <span className="font-mono text-lg font-bold text-green-600">
                          +${(payout.amount / 1_000_000).toFixed(4)} USDC
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fee Information */}
                <div className="p-4 border-2 border-primary bg-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary">account_balance</span>
                    <span className="font-mono font-bold text-primary">Platform Fee Collected</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-accent">
                      0.3% fee on total pool to cover gas and operations
                    </span>
                    <span className="text-xl font-display font-bold text-primary">
                      ${(betResults.feeCollected / 1_000_000).toFixed(4)} USDC
                    </span>
                  </div>
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
                        href={tx.hash.startsWith('pending-') ? '#' : `https://explorer.movementnetwork.xyz/txn/${tx.hash}?network=testnet`}
                        target={tx.hash.startsWith('pending-') ? '_self' : '_blank'}
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
                          {!tx.hash.startsWith('pending-') && (
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

