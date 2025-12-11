'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { getAvatarById, getAvatarUrl, AVATAR_OPTIONS } from '@/lib/avatars';
import { transferUSDCFromFaucet, aptos } from '@/lib/move-wallet';
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { buildSetProfilePayload, buildCreateGroupPayload, buildJoinGroupPayload, buildCreateBetPayload, buildPlaceWagerPayload, buildResolveBetPayload, getGroupsCount, getBetsCount } from '@/lib/contract';

// USDC Metadata address on Movement testnet
const USDC_METADATA_ADDR = '0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7';

// Faucet wallet private key (loaded with 10 USDC)
const FAUCET_PRIVATE_KEY = 'b62aff094a9ab76359c9b7ed7c3e7595831b476f71b8bc6d07e10cf1e19836e0';

// Random words for group and bet names
const ADJECTIVES = ['Epic', 'Cosmic', 'Wild', 'Mega', 'Super', 'Crazy', 'Lucky', 'Golden', 'Turbo', 'Ultimate'];
const NOUNS = ['Dragons', 'Warriors', 'Champions', 'Legends', 'Heroes', 'Sharks', 'Tigers', 'Eagles', 'Phoenix', 'Wolves'];
const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
const BET_SUBJECTS = [
  ['Bitcoin', '$100k by end of year'],
  ['Ethereum', '$5k by summer'],
  ['Movement', 'top 10 by 2025'],
  ['Solana', '$200 next month'],
  ['AI', 'pass Turing test this year'],
  ['Mars', 'colony by 2030'],
  ['Flying cars', 'mainstream by 2028'],
  ['Cure for baldness', 'discovered this year'],
  ['Time travel', 'invented by 2050'],
  ['Aliens', 'contact made this decade']
];

type DemoStep = 
  | 'start'
  | 'user1-wallet'
  | 'user1-profile-setup'
  | 'user1-profile-save'
  | 'user1-fund-usdc'
  | 'user1-create-group'
  | 'user1-create-bet'
  | 'user1-place-wager'
  | 'user2-wallet'
  | 'user2-profile-setup'
  | 'user2-profile-save'
  | 'user2-fund-usdc'
  | 'user2-join-group'
  | 'user2-place-wager'
  | 'user1-resolve-bet'
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

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomName(): string {
  return randomChoice(NAMES);
}

function generateGroupName(): string {
  return `${randomChoice(ADJECTIVES)} ${randomChoice(NOUNS)}`;
}

function generateBetQuestion(): string {
  const [subject, prediction] = randomChoice(BET_SUBJECTS);
  return `Will ${subject} reach ${prediction}?`;
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
  const txResponse = await aptos.waitForTransaction({
    transactionHash: result.pendingTx.hash,
  });

  return {
    hash: result.pendingTx.hash,
    success: txResponse.success,
  };
}

export default function DemoPage() {
  const { showToast } = useToast();
  
  const [step, setStep] = useState<DemoStep>('start');
  const [user1, setUser1] = useState<DemoUser>({
    name: '',
    avatarId: 0,
    address: null,
    balance: 0,
    step: 'Ready'
  });
  const [user2, setUser2] = useState<DemoUser>({
    name: '',
    avatarId: 0,
    address: null,
    balance: 0,
    step: 'Ready'
  });
  const [groupName, setGroupName] = useState('');
  const [groupPassword, setGroupPassword] = useState('secret123');
  const [betQuestion, setBetQuestion] = useState('');
  const [processing, setProcessing] = useState(false);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [betId, setBetId] = useState<number | null>(null);
  const [betAdminAddress, setBetAdminAddress] = useState<string | null>(null);
  
  // Store wallet instances for each user
  const [user1Wallet, setUser1Wallet] = useState<any>(null);
  const [user2Wallet, setUser2Wallet] = useState<any>(null);
  
  // Transaction history
  const [txHistory, setTxHistory] = useState<TransactionRecord[]>([]);

  // Clean up demo wallet on unmount
  useEffect(() => {
    return () => {
      // Remove any temporary demo wallet keys
      localStorage.removeItem('friendfi_demo_active_wallet');
    };
  }, []);

  // Initialize random data
  useEffect(() => {
    setUser1(prev => ({
      ...prev,
      name: generateRandomName(),
      avatarId: Math.floor(Math.random() * 40)
    }));
    setUser2(prev => ({
      ...prev,
      name: generateRandomName(),
      avatarId: Math.floor(Math.random() * 40)
    }));
    setGroupName(generateGroupName());
    setBetQuestion(generateBetQuestion());
  }, []);

  // Helper to temporarily set a demo wallet for transactions
  const switchToUserWallet = (userNum: 1 | 2) => {
    const wallet = userNum === 1 ? user1Wallet : user2Wallet;
    if (wallet) {
      // Use a temporary key for demo transactions
      localStorage.setItem('friendfi_demo_active_wallet', JSON.stringify(wallet));
    }
  };

  // Helper to record transaction in history
  const recordTransaction = (action: string, user: string, hash: string) => {
    setTxHistory(prev => [...prev, {
      action,
      user,
      hash,
      timestamp: Date.now()
    }]);
  };

  const regenerateGroupName = () => {
    setGroupName(generateGroupName());
  };

  const regenerateBetQuestion = () => {
    setBetQuestion(generateBetQuestion());
  };

  const createUserWallet = async (userNum: 1 | 2) => {
    setProcessing(true);
    const toastPosition = userNum === 2 ? 'left' : 'right';
    
    showToast({ 
      type: 'info', 
      title: `Creating wallet for User ${userNum}...`,
      position: toastPosition
    });
    
    try {
      // Generate a new Move wallet using Aptos SDK
      const account = Account.generate();
      const walletAddress = account.accountAddress.toString();
      const privateKey = account.privateKey.toString();
      
      // Simulate wallet creation delay for demo effect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const walletData = {
        address: walletAddress,
        privateKeyHex: privateKey
      };
      
      if (userNum === 1) {
        setUser1Wallet(walletData);
        setUser1(prev => ({
          ...prev,
          address: walletAddress,
          step: 'Wallet created ✓'
        }));
        setStep('user1-profile-setup');
      } else {
        setUser2Wallet(walletData);
        setUser2(prev => ({
          ...prev,
          address: walletAddress,
          step: 'Wallet created ✓'
        }));
        setStep('user2-profile-setup');
      }
      
      showToast({ 
        type: 'success', 
        title: `Wallet created!`,
        message: `Address: ${walletAddress.slice(0, 10)}...`,
        position: toastPosition
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to create wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
        position: toastPosition
      });
    } finally {
      setProcessing(false);
    }
  };

  const saveUserProfile = async (userNum: 1 | 2) => {
    setProcessing(true);
    const userName = userNum === 1 ? user1.name : user2.name;
    const avatarId = userNum === 1 ? user1.avatarId : user2.avatarId;
    const wallet = userNum === 1 ? user1Wallet : user2Wallet;
    const toastPosition = userNum === 2 ? 'left' : 'right';
    
    if (!wallet) {
      showToast({ type: 'error', title: 'Wallet not found', position: toastPosition });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `Saving ${userName}'s profile...`,
      position: toastPosition
    });
    
    try {
      const payload = buildSetProfilePayload(userName, avatarId);
      const result = await executeDemoTransaction(wallet, payload);
      
      recordTransaction('Set Profile', userName, result.hash);
      
      if (userNum === 1) {
        setUser1(prev => ({ ...prev, step: 'Profile saved ✓' }));
        setStep('user1-fund-usdc');
      } else {
        setUser2(prev => ({ ...prev, step: 'Profile saved ✓' }));
        setStep('user2-fund-usdc');
      }
      
      showToast({ 
        type: 'success', 
        title: 'Profile saved!',
        txHash: result.hash,
        position: toastPosition
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to save profile',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        position: toastPosition
      });
    } finally {
      setProcessing(false);
    }
  };

  const fundUSDC = async (userNum: 1 | 2) => {
    setProcessing(true);
    const userName = userNum === 1 ? user1.name : user2.name;
    const userAddress = userNum === 1 ? user1.address : user2.address;
    const amount = userNum === 1 ? 0.02 : 0.01; // 0.02 USDC for User 1, 0.01 USDC for User 2
    const toastPosition = userNum === 2 ? 'left' : 'right';
    
    showToast({ 
      type: 'info', 
      title: `Funding ${userName} with ${amount} USDC...`,
      position: toastPosition
    });
    
    try {
      if (!userAddress) {
        throw new Error('User address not found');
      }

      // Transfer USDC from faucet wallet (pays its own gas)
      const result = await transferUSDCFromFaucet(
        FAUCET_PRIVATE_KEY,
        userAddress,
        amount
      );
      
      recordTransaction(`Fund ${amount} USDC`, userName, result.hash);
      
      if (userNum === 1) {
        setUser1(prev => ({ 
          ...prev, 
          balance: amount,
          step: `Funded with ${amount} USDC ✓`
        }));
        setStep('user1-create-group');
      } else {
        setUser2(prev => ({ 
          ...prev, 
          balance: amount,
          step: `Funded with ${amount} USDC ✓`
        }));
        setStep('user2-join-group');
      }
      
      showToast({ 
        type: 'success', 
        title: `Funded with ${amount} USDC!`,
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
      const payload = buildCreateGroupPayload(groupName, groupPassword);
      const result = await executeDemoTransaction(user1Wallet, payload);
      
      recordTransaction('Create Group', user1.name, result.hash);
      
      // Get the new group ID
      const count = await getGroupsCount();
      const newGroupId = count - 1;
      
      setGroupId(newGroupId);
      setUser1(prev => ({ ...prev, step: 'Group created ✓' }));
      setStep('user1-create-bet');
      
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

  const createDemoBet = async () => {
    setProcessing(true);
    
    if (!user1Wallet) {
      showToast({ type: 'error', title: 'Wallet not found' });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: 'Creating bet...' 
    });
    
    try {
      const outcomes = ['YES', 'NO'];
      const payload = buildCreateBetPayload(groupId!, betQuestion, outcomes, user1Wallet.address);
      const result = await executeDemoTransaction(user1Wallet, payload);
      
      recordTransaction('Create Bet', user1.name, result.hash);
      
      // Get the new bet ID
      const count = await getBetsCount();
      const newBetId = count - 1;
      
      setBetId(newBetId);
      setBetAdminAddress(user1.address);
      setUser1(prev => ({ ...prev, step: 'Bet created ✓' }));
      setStep('user1-place-wager');
      
      showToast({ 
        type: 'success', 
        title: `Bet created! (ID: ${newBetId})`,
        txHash: result.hash
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to create bet',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0
      });
    } finally {
      setProcessing(false);
    }
  };

  const placeDemoWager = async (userNum: 1 | 2, outcome: number) => {
    setProcessing(true);
    const userName = userNum === 1 ? user1.name : user2.name;
    const wallet = userNum === 1 ? user1Wallet : user2Wallet;
    const toastPosition = userNum === 2 ? 'left' : 'right';
    
    if (!wallet) {
      showToast({ type: 'error', title: 'Wallet not found', position: toastPosition });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `${userName} placing wager on ${outcome === 0 ? 'YES' : 'NO'}...`,
      position: toastPosition
    });
    
    try {
      const amount = 10000; // 0.01 USDC (6 decimals)
      const payload = buildPlaceWagerPayload(betId!, outcome, amount);
      const result = await executeDemoTransaction(wallet, payload);
      
      recordTransaction(`Place Wager (${outcome === 0 ? 'YES' : 'NO'})`, userName, result.hash);
      
      if (userNum === 1) {
        setUser1(prev => ({ 
          ...prev, 
          balance: prev.balance - 0.01,
          step: 'Wagered 0.01 USDC ✓'
        }));
        setStep('user2-wallet');
      } else {
        setUser2(prev => ({ 
          ...prev, 
          balance: prev.balance - 0.01,
          step: 'Wagered 0.01 USDC ✓'
        }));
        setStep('user1-resolve-bet');
      }
      
      showToast({ 
        type: 'success', 
        title: 'Wager placed!',
        txHash: result.hash,
        position: toastPosition
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to place wager',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        position: toastPosition
      });
    } finally {
      setProcessing(false);
    }
  };

  const joinDemoGroup = async () => {
    setProcessing(true);
    
    if (!user2Wallet) {
      showToast({ type: 'error', title: 'Wallet not found', position: 'left' });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `${user2.name} joining "${groupName}"...`,
      position: 'left'
    });
    
    try {
      const payload = buildJoinGroupPayload(groupId!, groupPassword);
      const result = await executeDemoTransaction(user2Wallet, payload);
      
      recordTransaction('Join Group', user2.name, result.hash);
      
      setUser2(prev => ({ ...prev, step: 'Joined group ✓' }));
      setStep('user2-place-wager');
      
      showToast({ 
        type: 'success', 
        title: 'Joined group!',
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

  const resolveDemoBet = async () => {
    setProcessing(true);
    
    if (!user1Wallet) {
      showToast({ type: 'error', title: 'Wallet not found' });
      setProcessing(false);
      return;
    }
    
    showToast({ 
      type: 'info', 
      title: `${user1.name} resolving bet...` 
    });
    
    try {
      const winningOutcome = 0; // YES wins
      const payload = buildResolveBetPayload(betId!, winningOutcome);
      const result = await executeDemoTransaction(user1Wallet, payload);
      
      recordTransaction('Resolve Bet (YES wins)', user1.name, result.hash);
      
      setUser1(prev => ({ ...prev, step: 'Bet resolved ✓' }));
      setStep('complete');
      
      showToast({ 
        type: 'success', 
        title: 'Bet resolved!',
        message: 'Winners have been paid out',
        txHash: result.hash
      });
    } catch (error) {
      showToast({ 
        type: 'error', 
        title: 'Failed to resolve bet',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0
      });
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    // Clean up any demo wallet
    localStorage.removeItem('friendfi_demo_active_wallet');
    
    setStep('start');
    setUser1({
      name: generateRandomName(),
      avatarId: Math.floor(Math.random() * 40),
      address: null,
      balance: 0,
      step: 'Ready'
    });
    setUser2({
      name: generateRandomName(),
      avatarId: Math.floor(Math.random() * 40),
      address: null,
      balance: 0,
      step: 'Ready'
    });
    setGroupName(generateGroupName());
    setBetQuestion(generateBetQuestion());
    setGroupId(null);
    setBetId(null);
    setBetAdminAddress(null);
    setUser1Wallet(null);
    setUser2Wallet(null);
    setTxHistory([]);
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <Logo size="sm" />
          <Button onClick={reset} variant="secondary" size="sm">
            <span className="material-symbols-outlined">refresh</span>
            Reset Demo
          </Button>
        </div>
        <h1 className="text-text text-3xl font-display font-bold mb-2">Live Demo</h1>
        <p className="text-accent font-mono text-sm">
          Watch two users create a prediction market in real-time
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {step === 'start' ? (
          <Card>
            <CardContent className="text-center py-16">
              <h2 className="text-text text-2xl font-display font-bold mb-4">
                Ready to see Friend-Fi in action?
              </h2>
              <p className="text-accent font-mono mb-8">
                This demo shows how fast and easy it is to create and participate in prediction markets
              </p>
              <Button onClick={() => createUserWallet(1)} size="lg">
                <span className="material-symbols-outlined">play_arrow</span>
                Start Demo
              </Button>
            </CardContent>
          </Card>
        ) : step === 'complete' ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="text-center py-16">
                <span className="material-symbols-outlined text-green-600 text-6xl mb-4">check_circle</span>
                <h2 className="text-text text-2xl font-display font-bold mb-4">
                  Demo Complete! 🎉
                </h2>
                <p className="text-accent font-mono mb-2">
                  {user1.name} created a group and bet
                </p>
                <p className="text-accent font-mono mb-8">
                  {user2.name} joined and placed a wager
                </p>
                <p className="text-green-600 font-mono font-bold mb-8">
                  {txHistory.length} transactions completed
                </p>
                <Button onClick={reset} size="lg">
                  <span className="material-symbols-outlined">replay</span>
                  Run Again
                </Button>
              </CardContent>
            </Card>

            {/* Transaction History */}
            <Card>
              <CardContent>
                <h3 className="text-text text-xl font-display font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">history</span>
                  Transaction History
                </h3>
                <div className="space-y-2">
                  {txHistory.map((tx, idx) => (
                    <div key={idx} className="p-3 border-2 border-text bg-background flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-text font-mono font-bold text-sm">{tx.action}</p>
                        <p className="text-accent font-mono text-xs">by {tx.user}</p>
                      </div>
                      <a
                        href={`https://explorer.movementnetwork.xyz/txn/${tx.hash}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-text font-mono text-xs flex items-center gap-1"
                      >
                        View
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* User 1 */}
            <UserPanel
              user={user1}
              userNum={1}
              groupName={groupName}
              groupPassword={groupPassword}
              betQuestion={betQuestion}
              step={step}
              processing={processing}
              onCreateWallet={() => createUserWallet(1)}
              onSaveProfile={() => saveUserProfile(1)}
              onFundUSDC={() => fundUSDC(1)}
              onCreateGroup={createDemoGroup}
              onCreateBet={createDemoBet}
              onPlaceWager={(outcome) => placeDemoWager(1, outcome)}
              onResolveBet={resolveDemoBet}
              onRegenerateGroup={regenerateGroupName}
              onRegenerateBet={regenerateBetQuestion}
              onUpdateUser1={setUser1}
              onUpdateUser2={setUser2}
            />

            {/* User 2 */}
            <UserPanel
              user={user2}
              userNum={2}
              groupName={groupName}
              groupPassword={groupPassword}
              betQuestion={betQuestion}
              step={step}
              processing={processing}
              onCreateWallet={() => createUserWallet(2)}
              onSaveProfile={() => saveUserProfile(2)}
              onFundUSDC={() => fundUSDC(2)}
              onJoinGroup={joinDemoGroup}
              onPlaceWager={(outcome) => placeDemoWager(2, outcome)}
              onUpdateUser1={setUser1}
              onUpdateUser2={setUser2}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface UserPanelProps {
  user: DemoUser;
  userNum: 1 | 2;
  groupName: string;
  groupPassword: string;
  betQuestion: string;
  step: DemoStep;
  processing: boolean;
  onCreateWallet?: () => void;
  onSaveProfile?: () => void;
  onFundUSDC?: () => void;
  onCreateGroup?: () => void;
  onCreateBet?: () => void;
  onJoinGroup?: () => void;
  onPlaceWager?: (outcome: number) => void;
  onResolveBet?: () => void;
  onRegenerateGroup?: () => void;
  onRegenerateBet?: () => void;
  onUpdateUser1?: (user: DemoUser) => void;
  onUpdateUser2?: (user: DemoUser) => void;
}

function UserPanel({
  user,
  userNum,
  groupName,
  groupPassword,
  betQuestion,
  step,
  processing,
  onCreateWallet,
  onSaveProfile,
  onFundUSDC,
  onCreateGroup,
  onCreateBet,
  onJoinGroup,
  onPlaceWager,
  onResolveBet,
  onRegenerateGroup,
  onRegenerateBet,
  onUpdateUser1,
  onUpdateUser2
}: UserPanelProps) {
  const avatar = getAvatarById(user.avatarId);
  const avatarUrl = avatar ? getAvatarUrl(avatar.seed, avatar.style) : '';

  const isActive = (stepName: string) => step.includes(stepName);

  return (
    <div className="space-y-4">
      {/* User Header */}
      <Card className={userNum === 1 ? 'border-primary' : 'border-secondary'}>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 border-4 flex items-center justify-center text-2xl font-display font-bold ${
              userNum === 1 ? 'border-primary bg-primary/20 text-primary' : 'border-secondary bg-secondary/20 text-secondary'
            }`}>
              {userNum}
            </div>
            <div className="flex-1">
              <h3 className="text-text text-xl font-display font-bold">{user.name || `User ${userNum}`}</h3>
              <p className="text-accent text-sm font-mono">{user.step}</p>
              {user.balance > 0 && (
                <p className="text-green-600 text-sm font-mono font-bold">{user.balance.toFixed(2)} USDC</p>
              )}
            </div>
            {avatarUrl && (
              <img src={avatarUrl} alt="Avatar" className="w-16 h-16 border-2 border-text" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wallet Creation */}
      {(step === `user${userNum}-wallet`) && (
        <Card className={isActive(`user${userNum}-wallet`) ? 'border-4 border-primary' : ''}>
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">account_balance_wallet</span>
              Create Wallet
            </h4>
            <p className="text-accent text-sm font-mono mb-4">
              Generate a new wallet with a random private key
            </p>
            <Button onClick={onCreateWallet} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">add</span>
              Generate Wallet
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profile Setup */}
      {(step === `user${userNum}-profile-setup` || step === `user${userNum}-profile-save`) && (
        <Card className={isActive(`user${userNum}-profile`) ? 'border-4 border-primary' : ''}>
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">person</span>
              Set Profile
            </h4>
            
            {/* Name Input */}
            <div className="mb-4">
              <label className="text-text font-mono font-bold text-sm block mb-2">Username</label>
              <input
                type="text"
                value={user.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  if (userNum === 1) {
                    onUpdateUser1?.({ ...user, name: newName });
                  } else {
                    onUpdateUser2?.({ ...user, name: newName });
                  }
                }}
                className="w-full px-3 py-2 bg-background border-2 border-text text-text font-mono focus:outline-none focus:border-primary"
                placeholder="Enter username..."
              />
            </div>

            {/* Avatar Preview */}
            <div className="flex items-center gap-4 mb-4 p-3 border-2 border-text bg-background">
              {avatarUrl && (
                <img src={avatarUrl} alt="Avatar" className="w-12 h-12 border-2 border-text" />
              )}
              <div className="flex-1">
                <p className="text-text font-mono font-bold">{user.name}</p>
                <p className="text-accent text-xs font-mono">Avatar #{user.avatarId}</p>
              </div>
            </div>

            {/* Avatar Grid */}
            <div className="mb-4">
              <label className="text-text font-mono font-bold text-sm block mb-2">Choose Avatar</label>
              <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto border-2 border-text p-2 bg-background">
                {AVATAR_OPTIONS.slice(0, 20).map((option, idx) => {
                  const url = getAvatarUrl(option.seed, option.style);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (userNum === 1) {
                          onUpdateUser1?.({ ...user, avatarId: idx });
                        } else {
                          onUpdateUser2?.({ ...user, avatarId: idx });
                        }
                      }}
                      className={`w-full aspect-square border-2 hover:border-primary transition-colors ${
                        user.avatarId === idx ? 'border-primary' : 'border-text'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={onSaveProfile} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">save</span>
              Save Profile to Blockchain
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fund USDC */}
      {step === `user${userNum}-fund-usdc` && (
        <Card className={isActive(`user${userNum}-fund`) ? 'border-4 border-primary' : ''}>
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">paid</span>
              Fund Account
            </h4>
            <p className="text-accent text-sm font-mono mb-4">
              Transfer {userNum === 1 ? '0.02' : '0.01'} USDC from faucet to test wallet
            </p>
            <Button onClick={onFundUSDC} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">send</span>
              Send {userNum === 1 ? '0.02' : '0.01'} USDC
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Group */}
      {step === 'user1-create-group' && userNum === 1 && (
        <Card className="border-4 border-primary">
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">groups</span>
              Create Group
            </h4>
            <div className="space-y-3 mb-4">
              <div className="p-3 border-2 border-text bg-background">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-text font-mono font-bold text-sm">Group Name</label>
                  <button onClick={onRegenerateGroup} className="text-primary hover:text-text">
                    <span className="material-symbols-outlined text-sm">refresh</span>
                  </button>
                </div>
                <p className="text-accent font-mono">{groupName}</p>
              </div>
              <div className="p-3 border-2 border-text bg-background">
                <label className="text-text font-mono font-bold text-sm block mb-1">Password</label>
                <p className="text-accent font-mono">{groupPassword}</p>
              </div>
            </div>
            <Button onClick={onCreateGroup} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">add_circle</span>
              Create Group
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Bet */}
      {step === 'user1-create-bet' && userNum === 1 && (
        <Card className="border-4 border-primary">
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">casino</span>
              Create Bet
            </h4>
            <div className="space-y-3 mb-4">
              <div className="p-3 border-2 border-text bg-background">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-text font-mono font-bold text-sm">Question</label>
                  <button onClick={onRegenerateBet} className="text-primary hover:text-text">
                    <span className="material-symbols-outlined text-sm">refresh</span>
                  </button>
                </div>
                <p className="text-accent font-mono text-sm">{betQuestion}</p>
              </div>
              <div className="p-3 border-2 border-text bg-background">
                <label className="text-text font-mono font-bold text-sm block mb-2">Outcomes</label>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 border border-text bg-green-600/20 text-center">
                    <span className="text-text font-mono font-bold">YES</span>
                  </div>
                  <div className="flex-1 p-2 border border-text bg-secondary/20 text-center">
                    <span className="text-text font-mono font-bold">NO</span>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={onCreateBet} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">add_circle</span>
              Create Bet
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Place Wager */}
      {step === `user${userNum}-place-wager` && (
        <Card className="border-4 border-primary">
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">payments</span>
              Place Wager
            </h4>
            <div className="mb-4 p-3 border-2 border-text bg-background">
              <p className="text-text font-mono font-bold text-sm mb-2">{betQuestion}</p>
              <p className="text-accent font-mono text-xs">Amount: 0.01 USDC</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => onPlaceWager && onPlaceWager(0)} disabled={processing} className="bg-green-600">
                <span className="material-symbols-outlined">thumb_up</span>
                Bet YES
              </Button>
              <Button onClick={() => onPlaceWager && onPlaceWager(1)} disabled={processing} className="bg-secondary">
                <span className="material-symbols-outlined">thumb_down</span>
                Bet NO
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Join Group */}
      {step === 'user2-join-group' && userNum === 2 && (
        <Card className="border-4 border-primary">
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">login</span>
              Join Group
            </h4>
            <div className="mb-4 p-3 border-2 border-text bg-background">
              <p className="text-text font-mono font-bold">{groupName}</p>
              <p className="text-accent font-mono text-xs mt-1">Password: {groupPassword}</p>
            </div>
            <Button onClick={onJoinGroup} disabled={processing} className="w-full">
              <span className="material-symbols-outlined">how_to_reg</span>
              Join Group
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resolve Bet */}
      {step === 'user1-resolve-bet' && userNum === 1 && (
        <Card className="border-4 border-primary">
          <CardContent>
            <h4 className="text-text text-lg font-display font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">gavel</span>
              Resolve Bet
            </h4>
            <div className="mb-4 p-3 border-2 border-text bg-background">
              <p className="text-text font-mono font-bold text-sm">{betQuestion}</p>
              <p className="text-accent font-mono text-xs mt-2">
                Total Pool: 0.02 USDC
              </p>
            </div>
            <Button onClick={onResolveBet} disabled={processing} className="w-full bg-green-600">
              <span className="material-symbols-outlined">check_circle</span>
              Resolve as YES
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

