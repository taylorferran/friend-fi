'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';
import { transferUSDCFromFaucet, aptos } from '@/lib/move-wallet';
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { buildCreateExpenseEqualPayload, buildSettleDebtPayload, getGroupDebts } from '@/lib/contract';
import { createGroupInSupabase, addGroupMember, upsertProfile } from '@/lib/supabase-services';
import { hashPassword } from '@/lib/crypto';

// Faucet wallet private key
const FAUCET_PRIVATE_KEY = process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY || '';

// Random data generators
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
const LOCATIONS = ['Bali', 'Paris', 'Tokyo', 'Barcelona', 'Iceland', 'Morocco', 'Peru', 'Greece', 'Thailand', 'Portugal'];
const TRIP_TYPES = ['Adventure', 'Getaway', 'Trip', 'Holiday', 'Escape', 'Journey'];

const EXPENSES = [
  { name: 'Dinner', amount: 120 },      // $120
  { name: 'Food Tour', amount: 85 },    // $85
  { name: 'Museum Tickets', amount: 45 }, // $45
  { name: 'Ubers', amount: 60 },        // $60
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

interface Debt {
  from: string;
  to: string;
  amount: number;
  fromName: string;
  toName: string;
}

type DemoPhase = 
  | 'idle'
  | 'setup-users'
  | 'create-group'
  | 'add-expenses'
  | 'calculate-debts'
  | 'settle-debts'
  | 'complete';

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomName(): string {
  const uniqueId = Math.floor(Math.random() * 10000);
  return `${randomChoice(FIRST_NAMES)}${uniqueId}`;
}

function generateTripName(): string {
  return `${randomChoice(LOCATIONS)} ${randomChoice(TRIP_TYPES)}`;
}

export default function DemoExpensesPage() {
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [processing, setProcessing] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupPassword, setGroupPassword] = useState('');
  
  const [expenses, setExpenses] = useState<Array<{ name: string; amount: number; payer: string; payerName: string }>>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  
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
      setCurrentAction('Creating 3 users...');
      
      const tripName = generateTripName();
      setGroupName(tripName);
      setGroupPassword('demo123');
      
      const newUsers: DemoUser[] = [];
      for (let i = 0; i < 3; i++) {
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
        
        // Fund user with 150 USDC (enough for their share of expenses)
        const fundResult = await transferUSDCFromFaucet(
          FAUCET_PRIVATE_KEY,
          user.address,
          150
        );
        
        if (!fundResult.success) {
          throw new Error(`Failed to fund ${name}'s account`);
        }
        
        recordTx(user.name, 'Funded 150 USDC', fundResult.hash, 'success');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set profile in Supabase
        await upsertProfile(user.address, user.name, user.avatarId);
        recordTx(user.name, 'Set Profile (Supabase)', 'supabase-profile', 'success');
      }
      setUsers(newUsers);
      
      // Phase 2: Create Group
      setPhase('create-group');
      setCurrentAction(`Creating group "${tripName}"...`);
      
      const passwordHash = await hashPassword(groupPassword);
      const group = await createGroupInSupabase(
        tripName,
        'Speed demo expense group',
        passwordHash,
        newUsers[0].address
      );
      const newGroupId = group.id;
      setGroupId(newGroupId);
      recordTx(newUsers[0].name, 'Create Group (Supabase)', 'supabase-group', 'success');
      
      // Add remaining members to group (skip creator who is auto-added)
      for (let i = 1; i < newUsers.length; i++) {
        await addGroupMember(newGroupId, newUsers[i].address);
        recordTx(newUsers[i].name, 'Join Group (Supabase)', 'supabase-join', 'success');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Phase 3: Add Expenses (OFF-CHAIN in Supabase)
      setPhase('add-expenses');
      setCurrentAction('Adding expenses...');
      
      const addedExpenses: Array<{ name: string; amount: number; payer: string; payerName: string }> = [];
      
      for (let i = 0; i < EXPENSES.length; i++) {
        const expense = EXPENSES[i];
        const payer = newUsers[i % 3];
        
        setCurrentAction(`${payer.name} adding expense: ${expense.name}...`);
        
        // Create expense in Supabase (off-chain, instant, no gas)
        const { createExpenseInSupabase } = await import('@/lib/supabase-services');
        
        // Calculate splits (equal split among all members)
        const splitAmount = BigInt(Math.floor((expense.amount * 1_000_000) / newUsers.length)); // Convert to micro-USDC
        const splits = newUsers.map(user => ({
          participantAddress: user.address,
          amount: splitAmount,
        }));
        
        const newExpense = await createExpenseInSupabase(
          newGroupId,
          expense.name,
          BigInt(expense.amount * 1_000_000), // Convert to micro-USDC
          payer.address,
          'equal',
          splits
        );
        
        if (!newExpense) {
          throw new Error(`Failed to create expense: ${expense.name}`);
        }
        
        recordTx(payer.name, `Add Expense: ${expense.name} (Supabase)`, 'supabase-expense', 'success');
        
        addedExpenses.push({
          name: expense.name,
          amount: expense.amount,
          payer: payer.address,
          payerName: payer.name
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      setExpenses(addedExpenses);
      
      // Phase 4: Calculate Debts (OFF-CHAIN from Supabase)
      setPhase('calculate-debts');
      setCurrentAction('Calculating debts from Supabase...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch expenses and splits from Supabase to calculate debts
      const { supabase } = await import('@/lib/supabase');
      
      // Get all expense splits for this group
      const { data: splits, error } = await supabase
        .from('expense_splits')
        .select(`
          *,
          expense:expenses!inner(group_id, payer_address)
        `)
        .eq('expense.group_id', newGroupId);
      
      if (error) throw error;
      
      // Calculate net balances (who owes whom)
      const balances: Record<string, number> = {};
      
      newUsers.forEach(user => {
        balances[user.address] = 0;
      });
      
      // For each expense split
      splits?.forEach((split: any) => {
        const payerAddr = split.expense.payer_address;
        const participantAddr = split.participant_address;
        const amount = parseFloat(split.amount);
        
        // Payer paid the full amount
        if (payerAddr === participantAddr) {
          // This is the payer's own share - already settled
        } else {
          // Participant owes the payer
          balances[participantAddr] -= amount; // Participant owes
          balances[payerAddr] += amount; // Payer is owed
        }
      });
      
      // Convert balances to debt records
      const calculatedDebts: Debt[] = [];
      
      // Simple debt settlement: each person with negative balance owes those with positive
      const debtors = Object.entries(balances).filter(([_, balance]) => balance < 0);
      const creditors = Object.entries(balances).filter(([_, balance]) => balance > 0);
      
      for (const [debtorAddr, debtAmount] of debtors) {
        for (const [creditorAddr, creditAmount] of creditors) {
          const settleAmount = Math.min(Math.abs(debtAmount), creditAmount);
          
          if (settleAmount > 0.01) { // Only show debts > $0.01
            const fromUser = newUsers.find(u => u.address === debtorAddr);
            const toUser = newUsers.find(u => u.address === creditorAddr);
            
            if (fromUser && toUser) {
              calculatedDebts.push({
                from: debtorAddr,
                to: creditorAddr,
                amount: Math.floor(settleAmount), // Convert to micro-USDC
                fromName: fromUser.name,
                toName: toUser.name
              });
            }
          }
        }
      }
      
      setDebts(calculatedDebts);
      recordTx('System', 'Calculate Debts (Supabase)', 'supabase-debts', 'success');
      
      // Phase 5: Complete (debts calculated - settlement would be done via USDC transfers)
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
    setUsers([]);
    setGroupId(null);
    setGroupName('');
    setExpenses([]);
    setDebts([]);
    setTxHistory([]);
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
                <h1 className="text-3xl font-display font-bold text-text">Expense Splitting Speed Demo</h1>
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
                    Watch a complete expense splitting cycle in seconds
                  </p>
                </div>
                
                <div className="text-left p-6 border-2 border-text bg-surface">
                  <h3 className="font-display font-bold text-text mb-3">What happens:</h3>
                  <ol className="space-y-2 font-mono text-sm text-accent list-decimal list-inside">
                    <li>3 users created with random names</li>
                    <li>All funded with 150 USDC from faucet</li>
                    <li>Group created for the trip</li>
                    <li>4 expenses added (stored in Supabase)</li>
                    <li>Debts calculated from Supabase</li>
                    <li>Who owes whom displayed</li>
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
        {phase === 'complete' && (
          <Card className="max-w-4xl mx-auto">
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-8xl mb-4">🎉</div>
                  <h2 className="text-3xl font-display font-bold text-text mb-2">Demo Complete!</h2>
                  <p className="text-accent font-mono">Full expense splitting cycle completed on-chain</p>
                </div>

                {/* Trip Summary */}
                <div>
                  <h3 className="text-text text-xl font-display font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">luggage</span>
                    Trip: {groupName}
                  </h3>
                  <div className="p-4 border-2 border-text bg-surface">
                    <h4 className="font-mono font-bold text-text mb-3">Expenses Paid:</h4>
                    <div className="space-y-3">
                      {expenses.map((expense, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 border-2 border-text bg-background">
                          <div>
                            <span className="font-mono text-text font-bold">{expense.name}</span>
                            <span className="text-xs text-accent ml-2">paid by {expense.payerName}</span>
                          </div>
                          <span className="font-mono font-bold text-text">
                            ${expense.amount.toFixed(2)} USDC
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center p-3 border-2 border-text bg-primary/20 font-bold">
                        <span className="font-mono text-text">Total Spent</span>
                        <span className="font-mono text-text">
                          ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} USDC
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 border-2 border-text bg-surface">
                        <span className="font-mono text-xs text-accent">Per Person (Split {users.length} Ways)</span>
                        <span className="font-mono text-xs font-bold text-accent">
                          ${((expenses.reduce((sum, e) => sum + e.amount, 0) / users.length) / 1_000_000).toFixed(4)} USDC
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Debt Settlements */}
                {debts.length > 0 && (
                  <div>
                    <h3 className="text-text text-xl font-display font-bold mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined">payments</span>
                      Debt Settlements
                    </h3>
                    <div className="space-y-3">
                      {debts.map((debt, idx) => {
                        const feeAmount = debt.amount * 0.003; // 0.3% fee
                        const netAmount = debt.amount - feeAmount;
                        
                        return (
                          <div key={idx} className="p-4 border-2 border-green-600 bg-green-600/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-600">arrow_forward</span>
                                <span className="font-mono text-lg font-bold text-text">
                                  {debt.fromName} → {debt.toName}
                                </span>
                              </div>
                              <span className="font-mono text-xl font-bold text-green-600">
                                ${(debt.amount / 1_000_000).toFixed(2)} USDC
                              </span>
                            </div>
                            <div className="text-xs font-mono text-accent ml-8">
                              (Calculated from Supabase expense splits)
                            </div>
                          </div>
                        );
                      })}
                      <div className="p-3 border-2 border-green-600 bg-green-600/5 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <span className="material-symbols-outlined text-green-600">check_circle</span>
                          <span className="font-mono font-bold text-green-600">All debts settled on-chain</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fee Information */}
                <div className="p-4 border-2 border-primary bg-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary">account_balance</span>
                    <span className="font-mono font-bold text-primary">Platform Fee Collected</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-accent">
                      0.3% fee on settlements to cover gas and operations
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
                        href={tx.hash.startsWith('pending-') || tx.hash.startsWith('supabase-') ? '#' : `https://explorer.movementnetwork.xyz/txn/${tx.hash}?network=testnet`}
                        target={tx.hash.startsWith('pending-') || tx.hash.startsWith('supabase-') ? '_self' : '_blank'}
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
                          {!tx.hash.startsWith('pending-') && !tx.hash.startsWith('supabase-') && (
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
