'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { getAvatarById, getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';
import { transferUSDCFromFaucet, aptos } from '@/lib/move-wallet';
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { buildSetProfilePayload, buildCreateGroupPayload, buildJoinGroupPayload, buildCreateExpenseEqualPayload, buildSettleDebtPayload, getGroupsCount, getUserBalance, getGroupDebts } from '@/lib/contract';
import { Input } from '@/components/ui/Input';

// Faucet wallet private key
const FAUCET_PRIVATE_KEY = process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY || '';

// Random data generators
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
const LOCATIONS = ['Bali', 'Paris', 'Tokyo', 'Barcelona', 'Iceland', 'Morocco', 'Peru', 'Greece', 'Thailand', 'Portugal'];
const TRIP_TYPES = ['Adventure', 'Getaway', 'Trip', 'Holiday', 'Escape', 'Journey'];

const EXPENSES = [
  { name: 'Dinner', amount: 12000 },      // 0.012 USDC
  { name: 'Food Tour', amount: 9000 },    // 0.009 USDC
  { name: 'Museum Tickets', amount: 6000 }, // 0.006 USDC
  { name: 'Ubers', amount: 8000 },        // 0.008 USDC
];

type DemoStep = 
  | 'start'
  | 'user1-wallet' | 'user1-fund-usdc'
  | 'user2-wallet' | 'user2-fund-usdc'
  | 'user3-wallet' | 'user3-fund-usdc'
  | 'user1-create-group'
  | 'user2-join-group'
  | 'user3-join-group'
  | 'add-expense-1' | 'add-expense-2' | 'add-expense-3' | 'add-expense-4'
  | 'show-debts'
  | 'settle-debts'
  | 'complete';

interface DemoUser {
  name: string;
  avatarId: number;
  address: string | null;
  balance: number;
  step: string;
}

interface TransactionRecord {
  action: string;
  user: string;
  hash: string;
  timestamp: number;
}

interface Debt {
  from: string;
  to: string;
  amount: number;
  fromName: string;
  toName: string;
}

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

// Helper to execute transactions with a specific demo wallet
async function executeDemoTransaction(
  walletData: { address: string; privateKeyHex: string },
  payload: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: (string | string[])[];
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

export default function DemoExpensesPage() {
  const { showToast } = useToast();
  
  const [step, setStep] = useState<DemoStep>('start');
  const [user1, setUser1] = useState<DemoUser>({ name: '', avatarId: 0, address: null, balance: 0, step: 'Ready' });
  const [user2, setUser2] = useState<DemoUser>({ name: '', avatarId: 0, address: null, balance: 0, step: 'Ready' });
  const [user3, setUser3] = useState<DemoUser>({ name: '', avatarId: 0, address: null, balance: 0, step: 'Ready' });
  
  const [user1Wallet, setUser1Wallet] = useState<{ address: string; privateKeyHex: string } | null>(null);
  const [user2Wallet, setUser2Wallet] = useState<{ address: string; privateKeyHex: string } | null>(null);
  const [user3Wallet, setUser3Wallet] = useState<{ address: string; privateKeyHex: string } | null>(null);
  
  const [processing, setProcessing] = useState(false);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupPassword, setGroupPassword] = useState('');
  
  const [expenses, setExpenses] = useState<Array<{ name: string; amount: number; payer: string; payerName: string }>>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  
  const [txHistory, setTxHistory] = useState<TransactionRecord[]>([]);

  // Initialize random data
  useEffect(() => {
    setUser1({ ...user1, name: generateRandomName(), avatarId: Math.floor(Math.random() * AVATAR_OPTIONS.length) });
    setUser2({ ...user2, name: generateRandomName(), avatarId: Math.floor(Math.random() * AVATAR_OPTIONS.length) });
    setUser3({ ...user3, name: generateRandomName(), avatarId: Math.floor(Math.random() * AVATAR_OPTIONS.length) });
    setGroupName(generateTripName());
    setGroupPassword('password123');
  }, []);

  const recordTransaction = (action: string, user: string, hash: string) => {
    setTxHistory(prev => [...prev, { action, user, hash, timestamp: Date.now() }]);
  };

  const generateWallet = async (userNum: 1 | 2 | 3) => {
    setProcessing(true);
    
    const userName = userNum === 1 ? user1.name : userNum === 2 ? user2.name : user3.name;
    const avatarId = userNum === 1 ? user1.avatarId : userNum === 2 ? user2.avatarId : user3.avatarId;
    
    showToast({ 
      type: 'info', 
      title: `Generating wallet for ${userName}...`,
      position: userNum > 1 ? 'left' : 'right'
    });

    try {
      // Generate wallet
      const account = Account.generate();
      const walletData = {
        address: account.accountAddress.toString(),
        privateKeyHex: account.privateKey.toString().replace('0x', '')
      };

      // Save wallet
      if (userNum === 1) {
        setUser1Wallet(walletData);
        setUser1(prev => ({ 
          ...prev, 
          address: walletData.address,
          step: 'Wallet created ✓'
        }));
      } else if (userNum === 2) {
        setUser2Wallet(walletData);
        setUser2(prev => ({ 
          ...prev, 
          address: walletData.address,
          step: 'Wallet created ✓'
        }));
      } else {
        setUser3Wallet(walletData);
        setUser3(prev => ({ 
          ...prev, 
          address: walletData.address,
          step: 'Wallet created ✓'
        }));
      }

      showToast({ 
        type: 'success', 
        title: `Wallet created for ${userName}`,
        position: userNum > 1 ? 'left' : 'right'
      });

      // Automatically save profile
      showToast({ 
        type: 'info', 
        title: `Saving ${userName}'s profile...`,
        position: userNum > 1 ? 'left' : 'right'
      });

      const payload = buildSetProfilePayload(userName, avatarId);
      const result = await executeDemoTransaction(walletData, payload);
      
      recordTransaction('Set Profile', userName, result.hash);
      
      if (userNum === 1) {
        setUser1(prev => ({ ...prev, step: 'Profile saved ✓' }));
        setStep('user1-fund-usdc');
      } else if (userNum === 2) {
        setUser2(prev => ({ ...prev, step: 'Profile saved ✓' }));
        setStep('user2-fund-usdc');
      } else {
        setUser3(prev => ({ ...prev, step: 'Profile saved ✓' }));
        setStep('user3-fund-usdc');
      }
      
      showToast({ 
        type: 'success', 
        title: 'Profile saved!',
        txHash: result.hash,
        position: userNum > 1 ? 'left' : 'right'
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to create wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        position: userNum > 1 ? 'left' : 'right'
      });
    } finally {
      setProcessing(false);
    }
  };

  const saveUserProfile = async (userNum: 1 | 2 | 3) => {
    // This function is now integrated into generateWallet
    // Keeping for backwards compatibility but not used
  };

  const fundUSDC = async (userNum: 1 | 2 | 3) => {
    setProcessing(true);
    const userName = userNum === 1 ? user1.name : userNum === 2 ? user2.name : user3.name;
    const userAddress = userNum === 1 ? user1.address : userNum === 2 ? user2.address : user3.address;
    const amount = 0.05; // Enough for all expenses
    const toastPosition = userNum > 1 ? 'left' : 'right';
    
    if (!userAddress) {
      showToast({ type: 'error', title: 'No address found', position: toastPosition });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `Funding ${userName} with ${amount} USDC...`,
      position: toastPosition
    });
    
    try {
      const result = await transferUSDCFromFaucet(FAUCET_PRIVATE_KEY, userAddress, amount);
      
      recordTransaction(`Fund ${amount} USDC`, userName, result.hash);
      
      if (userNum === 1) {
        setUser1(prev => ({ ...prev, step: 'Funded ✓', balance: amount }));
        setStep('user1-create-group');
      } else if (userNum === 2) {
        setUser2(prev => ({ ...prev, step: 'Funded ✓', balance: amount }));
        setStep('user2-join-group');
      } else {
        setUser3(prev => ({ ...prev, step: 'Funded ✓', balance: amount }));
        setStep('user3-join-group');
      }
      
      showToast({ 
        type: 'success', 
        title: `${amount} USDC sent to ${userName}`,
        txHash: result.hash,
        position: toastPosition
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to fund account',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        position: toastPosition
      });
    } finally {
      setProcessing(false);
    }
  };

  const createDemoGroup = async () => {
    setProcessing(true);
    
    if (!user1Wallet) {
      showToast({ type: 'error', title: 'Wallet not found' });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `Creating group "${groupName}"...` 
    });
    
    try {
      const payload = buildCreateGroupPayload(groupName, groupPassword, `Shared expenses for ${groupName}`);
      const result = await executeDemoTransaction(user1Wallet, payload);
      
      recordTransaction('Create Group', user1.name, result.hash);
      
      const count = await getGroupsCount();
      const newGroupId = count - 1;
      
      setGroupId(newGroupId);
      setUser1(prev => ({ ...prev, step: 'Group created ✓' }));
      setStep('user2-wallet');
      
      showToast({ 
        type: 'success', 
        title: `Group created! (ID: ${newGroupId})`,
        txHash: result.hash
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to create group',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0
      });
    } finally {
      setProcessing(false);
    }
  };

  const joinDemoGroup = async (userNum: 2 | 3) => {
    setProcessing(true);
    
    const wallet = userNum === 2 ? user2Wallet : user3Wallet;
    const userName = userNum === 2 ? user2.name : user3.name;
    
    if (!wallet) {
      showToast({ type: 'error', title: 'Wallet not found', position: 'left' });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `${userName} joining "${groupName}"...`,
      position: 'left'
    });
    
    try {
      const payload = buildJoinGroupPayload(groupId!, groupPassword);
      const result = await executeDemoTransaction(wallet, payload);
      
      recordTransaction('Join Group', userName, result.hash);
      
      if (userNum === 2) {
        setUser2(prev => ({ ...prev, step: 'Joined group ✓' }));
        setStep('user3-wallet');
      } else {
        setUser3(prev => ({ ...prev, step: 'Joined group ✓' }));
        setStep('add-expense-1');
      }
      
      showToast({ 
        type: 'success', 
        title: `${userName} joined the group!`,
        txHash: result.hash,
        position: 'left'
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to join group',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        position: 'left'
      });
    } finally {
      setProcessing(false);
    }
  };

  const addExpense = async (expenseIndex: number) => {
    setProcessing(true);
    
    const expense = EXPENSES[expenseIndex];
    const payers = [
      { wallet: user1Wallet, name: user1.name, address: user1.address },
      { wallet: user2Wallet, name: user2.name, address: user2.address },
      { wallet: user3Wallet, name: user3.name, address: user3.address },
    ];
    const randomPayer = payers[expenseIndex % 3];
    
    const amountUSDC = expense.amount; // Fixed amount in micro-USDC
    
    if (!randomPayer.wallet || !randomPayer.address) {
      showToast({ type: 'error', title: 'Wallet not found' });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `${randomPayer.name} adding expense: ${expense.name}...`,
      position: randomPayer.wallet === user1Wallet ? 'right' : 'left'
    });
    
    try {
      const participants = [user1.address!, user2.address!, user3.address!];
      const payload = buildCreateExpenseEqualPayload(
        groupId!,
        expense.name,
        amountUSDC,
        participants
      );
      const result = await executeDemoTransaction(randomPayer.wallet, payload);
      
      recordTransaction(`Add Expense: ${expense.name}`, randomPayer.name, result.hash);
      
      setExpenses(prev => [...prev, {
        name: expense.name,
        amount: amountUSDC,
        payer: randomPayer.address!,
        payerName: randomPayer.name
      }]);
      
      const nextStep = expenseIndex < 3 
        ? `add-expense-${expenseIndex + 2}` as DemoStep
        : 'show-debts';
      setStep(nextStep);
      
      showToast({ 
        type: 'success', 
        title: `Expense added: ${expense.name}`,
        message: `Paid by ${randomPayer.name}`,
        txHash: result.hash,
        position: randomPayer.wallet === user1Wallet ? 'right' : 'left'
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to add expense',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0
      });
    } finally {
      setProcessing(false);
    }
  };

  const calculateDebts = async () => {
    setProcessing(true);
    
    showToast({ 
      type: 'info', 
      title: 'Calculating debts...'
    });
    
    try {
      const result = await getGroupDebts(groupId!);
      
      const calculatedDebts: Debt[] = [];
      for (let i = 0; i < result.debtors.length; i++) {
        const fromAddr = result.debtors[i];
        const toAddr = result.creditors[i];
        const amount = result.amounts[i];
        
        // Skip self-debts (shouldn't happen but just in case)
        if (fromAddr === toAddr) {
          continue;
        }
        
        const fromName = 
          fromAddr === user1.address ? user1.name :
          fromAddr === user2.address ? user2.name :
          user3.name;
        
        const toName =
          toAddr === user1.address ? user1.name :
          toAddr === user2.address ? user2.name :
          user3.name;
        
        calculatedDebts.push({
          from: fromAddr,
          to: toAddr,
          amount,
          fromName,
          toName
        });
      }
      
      setDebts(calculatedDebts);
      setStep('settle-debts');
      
      showToast({ 
        type: 'success', 
        title: 'Debts calculated!'
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to calculate debts',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0
      });
    } finally {
      setProcessing(false);
    }
  };

  const settleDebt = async (debt: Debt) => {
    setProcessing(true);
    
    const wallet = 
      debt.from === user1.address ? user1Wallet :
      debt.from === user2.address ? user2Wallet :
      user3Wallet;
    
    if (!wallet) {
      showToast({ type: 'error', title: 'Wallet not found' });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `${debt.fromName} settling debt...`,
      position: wallet === user1Wallet ? 'right' : 'left'
    });
    
    try {
      const payload = buildSettleDebtPayload(groupId!, debt.to, debt.amount);
      const result = await executeDemoTransaction(wallet, payload);
      
      recordTransaction(`Settle Debt to ${debt.toName}`, debt.fromName, result.hash);
      
      // Remove this debt from the list
      setDebts(prev => prev.filter(d => !(d.from === debt.from && d.to === debt.to)));
      
      showToast({ 
        type: 'success', 
        title: 'Debt settled!',
        message: `${debt.fromName} paid ${debt.toName}`,
        txHash: result.hash,
        position: wallet === user1Wallet ? 'right' : 'left'
      });
      
      // If no more debts, mark as complete
      if (debts.length === 1) {
        setTimeout(() => setStep('complete'), 1000);
      }
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to settle debt',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        position: wallet === user1Wallet ? 'right' : 'left'
      });
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setStep('start');
    setUser1({ name: generateRandomName(), avatarId: Math.floor(Math.random() * AVATAR_OPTIONS.length), address: null, balance: 0, step: 'Ready' });
    setUser2({ name: generateRandomName(), avatarId: Math.floor(Math.random() * AVATAR_OPTIONS.length), address: null, balance: 0, step: 'Ready' });
    setUser3({ name: generateRandomName(), avatarId: Math.floor(Math.random() * AVATAR_OPTIONS.length), address: null, balance: 0, step: 'Ready' });
    setUser1Wallet(null);
    setUser2Wallet(null);
    setUser3Wallet(null);
    setGroupId(null);
    setGroupName(generateTripName());
    setExpenses([]);
    setDebts([]);
    setTxHistory([]);
  };

  const isActive = (checkStep: string) => {
    return step.startsWith(checkStep);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-4 border-text bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Logo />
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-text">Expense Splitting Demo</h1>
                <p className="text-accent font-mono text-xs sm:text-sm">Three friends split holiday costs</p>
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

        {step === 'start' && (
          <Card className="max-w-2xl mx-auto">
            <CardContent>
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="p-6 bg-primary border-2 border-text">
                    <span className="material-symbols-outlined text-6xl text-text">receipt_long</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-text mb-2">Expense Splitting Demo</h2>
                  <p className="text-accent font-mono">
                    Three friends on holiday will split 4 expenses and settle their debts on-chain
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="p-4 border-2 border-text bg-surface">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary">groups</span>
                      <span className="font-mono font-bold text-text">3 Users</span>
                    </div>
                    <p className="text-accent text-sm font-mono">Each creates a wallet and joins the group</p>
                  </div>
                  <div className="p-4 border-2 border-text bg-surface">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary">receipt</span>
                      <span className="font-mono font-bold text-text">4 Expenses</span>
                    </div>
                    <p className="text-accent text-sm font-mono">Dinner, Food Tour, Museum, Ubers</p>
                  </div>
                  <div className="p-4 border-2 border-text bg-surface">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary">calculate</span>
                      <span className="font-mono font-bold text-text">Auto Split</span>
                    </div>
                    <p className="text-accent text-sm font-mono">Equal split between all participants</p>
                  </div>
                  <div className="p-4 border-2 border-text bg-surface">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary">paid</span>
                      <span className="font-mono font-bold text-text">USDC Settlement</span>
                    </div>
                    <p className="text-accent text-sm font-mono">On-chain debt settlement with USDC</p>
                  </div>
                </div>
                <Button onClick={() => setStep('user1-wallet')} className="w-full">
                  <span className="material-symbols-outlined">play_arrow</span>
                  Start Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step !== 'start' && step !== 'complete' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* User 1 Panel */}
            <UserPanel
              user={user1}
              userNum={1}
              isActive={isActive}
              step={step}
              processing={processing}
              onGenerateWallet={() => generateWallet(1)}
              onFundUSDC={() => fundUSDC(1)}
              onCreateGroup={createDemoGroup}
            />

            {/* User 2 Panel */}
            {(step.startsWith('user2') || step.startsWith('user3') || step.startsWith('add-expense') || step === 'show-debts' || step === 'settle-debts') && (
              <UserPanel
                user={user2}
                userNum={2}
                isActive={isActive}
                step={step}
                processing={processing}
                onGenerateWallet={() => generateWallet(2)}
                onFundUSDC={() => fundUSDC(2)}
                onJoinGroup={() => joinDemoGroup(2)}
              />
            )}

            {/* User 3 Panel */}
            {(step.startsWith('user3') || step.startsWith('add-expense') || step === 'show-debts' || step === 'settle-debts') && (
              <UserPanel
                user={user3}
                userNum={3}
                isActive={isActive}
                step={step}
                processing={processing}
                onGenerateWallet={() => generateWallet(3)}
                onFundUSDC={() => fundUSDC(3)}
                onJoinGroup={() => joinDemoGroup(3)}
              />
            )}
          </div>
        )}

        {/* Expense Adding Section */}
        {step.startsWith('add-expense') && (
          <Card className="mt-6">
            <CardContent>
              <h3 className="text-text text-lg sm:text-xl font-display font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">receipt</span>
                Adding Expenses
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {EXPENSES.map((expense, idx) => (
                  <div
                    key={expense.name}
                    className={`p-4 border-2 border-text ${
                      expenses.length > idx ? 'bg-green-100' : 'bg-surface'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">
                        {expenses.length > idx ? '✓' : (idx + 1)}
                      </div>
                      <div className="font-mono font-bold text-sm text-text">{expense.name}</div>
                      {expenses.length > idx && (
                        <div className="text-xs text-accent mt-1">
                          Paid by {expenses[idx].payerName}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => addExpense(expenses.length)}
                disabled={processing}
                className="w-full"
              >
                <span className="material-symbols-outlined">add</span>
                Add {EXPENSES[expenses.length].name}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Show Debts Section */}
        {step === 'show-debts' && (
          <Card className="mt-6">
            <CardContent>
              <h3 className="text-text text-lg sm:text-xl font-display font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">calculate</span>
                Expense Summary
              </h3>
              <div className="space-y-3 mb-6">
                {expenses.map((expense, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 border-2 border-text bg-surface">
                    <span className="font-mono text-text">{expense.name}</span>
                    <div className="text-right">
                      <div className="font-mono font-bold text-text">
                        ${(expense.amount / 1_000_000).toFixed(3)} USDC
                      </div>
                      <div className="text-xs text-accent">Paid by {expense.payerName}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={calculateDebts} disabled={processing} className="w-full">
                <span className="material-symbols-outlined">calculate</span>
                Calculate Who Owes What
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Settle Debts Section */}
        {step === 'settle-debts' && (
          <Card className="mt-6">
            <CardContent>
              <h3 className="text-text text-lg sm:text-xl font-display font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">paid</span>
                Settle Debts
              </h3>
              {debts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎉</div>
                  <p className="text-text font-mono font-bold mb-2">All debts settled!</p>
                  <p className="text-accent font-mono text-sm">Everyone is square</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {debts.map((debt, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 border-2 border-text bg-surface">
                      <div>
                        <div className="font-mono font-bold text-text">
                          {debt.fromName} → {debt.toName}
                        </div>
                        <div className="text-xs text-accent">
                          ${(debt.amount / 1_000_000).toFixed(3)} USDC
                        </div>
                      </div>
                      <Button
                        onClick={() => settleDebt(debt)}
                        disabled={processing}
                        size="sm"
                      >
                        <span className="material-symbols-outlined">send</span>
                        Settle
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Complete Screen */}
        {step === 'complete' && (
          <Card className="max-w-2xl mx-auto">
            <CardContent>
              <div className="text-center space-y-6">
                <div className="text-8xl">🎉</div>
                <div>
                  <h2 className="text-3xl font-display font-bold text-text mb-2">Demo Complete!</h2>
                  <p className="text-accent font-mono">
                    All expenses have been split and settled on-chain
                  </p>
                  <div className="mt-4 p-4 border-2 border-green-600 bg-green-600/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-green-600">payments</span>
                      <span className="font-mono font-bold text-green-600">Fee Monetization Active</span>
                    </div>
                    <p className="text-sm font-mono text-accent">
                      A 0.3% fee was collected on each settlement to cover gas costs and service fees. 
                      This ensures sustainable operations while keeping costs minimal for users.
                    </p>
                  </div>
                </div>

                {/* Settlement Summary */}
                <div className="text-left">
                  <h3 className="text-text text-lg font-display font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">receipt_long</span>
                    What Happened
                  </h3>
                  
                  {/* Expenses Breakdown */}
                  <div className="mb-4">
                    <h4 className="text-text font-mono font-bold text-sm mb-2">Expenses Paid:</h4>
                    <div className="space-y-2">
                      {expenses.map((expense, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 border-2 border-text bg-surface">
                          <div>
                            <span className="font-mono text-sm text-text">{expense.name}</span>
                            <span className="text-xs text-accent ml-2">by {expense.payerName}</span>
                          </div>
                          <span className="font-mono text-sm font-bold text-text">
                            ${(expense.amount / 1_000_000).toFixed(3)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center p-2 border-2 border-text bg-primary/20 font-bold">
                        <span className="font-mono text-sm text-text">Total Spent</span>
                        <span className="font-mono text-sm text-text">
                          ${(expenses.reduce((sum, e) => sum + e.amount, 0) / 1_000_000).toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 border-2 border-text bg-surface">
                        <span className="font-mono text-xs text-accent">Per Person (Split 3 Ways)</span>
                        <span className="font-mono text-xs font-bold text-accent">
                          ${((expenses.reduce((sum, e) => sum + e.amount, 0) / 3) / 1_000_000).toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Settlement Details */}
                  <div>
                    <h4 className="text-text font-mono font-bold text-sm mb-2">Settlements Made:</h4>
                    <div className="space-y-2">
                      {(() => {
                        // Calculate who paid what
                        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
                        const perPerson = totalExpenses / 3;
                        
                        // Calculate how much each person paid
                        const user1Paid = expenses.filter(e => e.payer === user1.address).reduce((sum, e) => sum + e.amount, 0);
                        const user2Paid = expenses.filter(e => e.payer === user2.address).reduce((sum, e) => sum + e.amount, 0);
                        const user3Paid = expenses.filter(e => e.payer === user3.address).reduce((sum, e) => sum + e.amount, 0);
                        
                        // Calculate balances
                        const user1Balance = user1Paid - perPerson;
                        const user2Balance = user2Paid - perPerson;
                        const user3Balance = user3Paid - perPerson;
                        
                        const settlements = [];
                        
                        // Build settlement summary
                        if (user1Balance > 0) {
                          if (user2Balance < 0) {
                            settlements.push({
                              from: user2.name,
                              to: user1.name,
                              amount: Math.min(user1Balance, Math.abs(user2Balance)),
                              reason: 'owed'
                            });
                          }
                          if (user3Balance < 0) {
                            settlements.push({
                              from: user3.name,
                              to: user1.name,
                              amount: Math.min(user1Balance, Math.abs(user3Balance)),
                              reason: 'owed'
                            });
                          }
                        }
                        if (user2Balance > 0) {
                          if (user3Balance < 0) {
                            settlements.push({
                              from: user3.name,
                              to: user2.name,
                              amount: Math.min(user2Balance, Math.abs(user3Balance)),
                              reason: 'owed'
                            });
                          }
                        }
                        
                        return settlements.map((settlement, idx) => {
                          const feeAmount = settlement.amount * 0.003; // 0.3% fee
                          const netAmount = settlement.amount - feeAmount;
                          
                          return (
                            <div key={idx} className="p-3 border-2 border-text bg-green-600/10">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-green-600 text-sm">arrow_forward</span>
                                  <span className="font-mono text-sm font-bold text-text">
                                    {settlement.from} → {settlement.to}
                                  </span>
                                </div>
                                <span className="font-mono text-sm font-bold text-green-600">
                                  ${(settlement.amount / 1_000_000).toFixed(3)}
                                </span>
                              </div>
                              <div className="text-xs font-mono text-accent ml-6">
                                Recipient received: ${(netAmount / 1_000_000).toFixed(4)} (0.3% fee: ${(feeAmount / 1_000_000).toFixed(4)})
                              </div>
                            </div>
                          );
                        });
                      })()}
                      <div className="p-2 border-2 border-green-600 bg-green-600/5">
                        <div className="flex items-center gap-2 justify-center">
                          <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                          <span className="font-mono text-xs font-bold text-green-600">All debts settled on-chain</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaction History */}
                <div className="text-left">
                  <h3 className="text-text text-lg font-display font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined">history</span>
                    Transaction History
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {txHistory.map((tx, idx) => (
                      <a
                        key={idx}
                        href={`https://explorer.movementnetwork.xyz/txn/${tx.hash}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 border-2 border-text bg-surface hover:bg-primary/10 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono text-sm font-bold text-text">{tx.action}</div>
                            <div className="font-mono text-xs text-accent">{tx.user}</div>
                          </div>
                          <span className="material-symbols-outlined text-text text-sm">open_in_new</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                <Button onClick={reset} className="w-full">
                  <span className="material-symbols-outlined">refresh</span>
                  Run Demo Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface UserPanelProps {
  user: DemoUser;
  userNum: 1 | 2 | 3;
  isActive: (step: string) => boolean;
  step: DemoStep;
  processing: boolean;
  onGenerateWallet: () => void;
  onFundUSDC: () => void;
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
}

function UserPanel({
  user,
  userNum,
  isActive,
  step,
  processing,
  onGenerateWallet,
  onFundUSDC,
  onCreateGroup,
  onJoinGroup,
}: UserPanelProps) {
  return (
    <div className="space-y-4">
      {/* User Header */}
      <Card className={isActive(`user${userNum}`) ? 'border-4 border-primary' : ''}>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 border-2 border-text bg-surface flex items-center justify-center overflow-hidden">
              {user.avatarId > 0 ? (
                <img src={getAvatarUrl(AVATAR_OPTIONS[user.avatarId].seed, AVATAR_OPTIONS[user.avatarId].style)} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-accent">person</span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-text">{user.name || `User ${userNum}`}</h3>
              <p className="text-xs font-mono text-accent">{user.step}</p>
            </div>
          </div>
          {user.address && (
            <div className="text-xs font-mono text-accent break-all">
              {user.address.slice(0, 6)}...{user.address.slice(-4)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Wallet */}
      {step === `user${userNum}-wallet` && (
        <Card className={isActive(`user${userNum}-wallet`) ? 'border-4 border-primary' : ''}>
          <CardContent>
            <h4 className="text-text text-base sm:text-lg font-display font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">account_balance_wallet</span>
              Generate Wallet & Profile
            </h4>
            <Button onClick={onGenerateWallet} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">add</span>
              Create Wallet
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fund USDC */}
      {step === `user${userNum}-fund-usdc` && (
        <Card className={isActive(`user${userNum}-fund`) ? 'border-4 border-primary' : ''}>
          <CardContent>
            <h4 className="text-text text-base sm:text-lg font-display font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">paid</span>
              Fund Account
            </h4>
            <p className="text-accent text-sm font-mono mb-4">
              Transfer 0.05 USDC from faucet
            </p>
            <Button onClick={onFundUSDC} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">send</span>
              Send 0.05 USDC
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Group (User 1 only) */}
      {step === 'user1-create-group' && userNum === 1 && onCreateGroup && (
        <Card className={isActive('user1-create') ? 'border-4 border-primary' : ''}>
          <CardContent>
            <h4 className="text-text text-base sm:text-lg font-display font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">group_add</span>
              Create Group
            </h4>
            <Button onClick={onCreateGroup} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">add_circle</span>
              Create Group
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Join Group (User 2 & 3) */}
      {(step === `user${userNum}-join-group`) && userNum > 1 && onJoinGroup && (
        <Card className={isActive(`user${userNum}-join`) ? 'border-4 border-primary' : ''}>
          <CardContent>
            <h4 className="text-text text-base sm:text-lg font-display font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">group</span>
              Join Group
            </h4>
            <Button onClick={onJoinGroup} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">login</span>
              Join Group
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

