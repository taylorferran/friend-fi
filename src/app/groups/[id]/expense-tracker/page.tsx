'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getGroupMembers, getGroupName, getProfiles, getGroupDebts, getGroupExpensesCount, buildCreateExpenseEqualPayload, buildSettleDebtPayload } from '@/lib/contract';
import { getAvatarById, getAvatarUrl } from '@/lib/avatars';
import { useToast } from '@/components/ui/Toast';
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

type Tab = 'expenses' | 'debts' | 'members';

interface MemberWithProfile {
  address: string;
  name?: string;
  avatarId?: number;
}

interface Debt {
  from: string;
  to: string;
  amount: number;
  fromName: string;
  toName: string;
}

export default function GroupExpenseTrackerPage() {
  const router = useRouter();
  const params = useParams();
  const { authenticated, ready } = usePrivy();
  const { wallet } = useMoveWallet();
  const { showToast } = useToast();
  const groupId = parseInt(params.id as string, 10);
  
  const [groupName, setGroupName] = useState(`Group #${groupId}`);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [expensesCount, setExpensesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [processing, setProcessing] = useState(false);
  
  // Add expense form state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  // Store group context
  useEffect(() => {
    if (!isNaN(groupId) && groupName) {
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: groupId,
        name: groupName,
      }));
    }
  }, [groupId, groupName]);

  // Load group data
  useEffect(() => {
    async function loadGroupData() {
      if (isNaN(groupId)) {
        setLoading(false);
        return;
      }

      try {
        const [name, groupMembers, expCount] = await Promise.all([
          getGroupName(groupId),
          getGroupMembers(groupId),
          getGroupExpensesCount(groupId),
        ]);

        setGroupName(name || `Group #${groupId}`);
        setMembers(groupMembers.map(address => ({ address })));
        setExpensesCount(expCount);

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

  // Load debts when debts tab is activated
  const loadDebts = async () => {
    if (isNaN(groupId)) return;
    
    setProcessing(true);
    try {
      const result = await getGroupDebts(groupId);
      
      const calculatedDebts: Debt[] = [];
      for (let i = 0; i < result.debtors.length; i++) {
        const fromAddr = result.debtors[i];
        const toAddr = result.creditors[i];
        const amount = result.amounts[i];
        
        // Skip self-debts
        if (fromAddr === toAddr) continue;
        
        const fromMember = members.find(m => m.address === fromAddr);
        const toMember = members.find(m => m.address === toAddr);
        
        calculatedDebts.push({
          from: fromAddr,
          to: toAddr,
          amount,
          fromName: fromMember?.name || `${fromAddr.slice(0, 8)}...`,
          toName: toMember?.name || `${toAddr.slice(0, 8)}...`,
        });
      }
      
      setDebts(calculatedDebts);
    } catch (error) {
      console.error('Error loading debts:', error);
      showToast({
        type: 'error',
        title: 'Failed to load debts',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'debts' && members.length > 0) {
      loadDebts();
    }
  }, [activeTab, members]);

  const handleAddExpense = async () => {
    if (!wallet?.privateKeyHex) {
      showToast({ type: 'error', title: 'Wallet not found' });
      return;
    }

    const amount = parseFloat(expenseAmount);
    if (!expenseName || isNaN(amount) || amount <= 0) {
      showToast({ type: 'error', title: 'Please enter valid expense details' });
      return;
    }

    setProcessing(true);
    try {
      // Convert to micro-USDC
      const amountMicroUSDC = Math.floor(amount * 1_000_000);
      
      const payload = buildCreateExpenseEqualPayload(
        groupId,
        expenseName,
        amountMicroUSDC,
        members.map(m => m.address)
      );

      const config = new AptosConfig({
        network: Network.CUSTOM,
        fullnode: "https://testnet.movementnetwork.xyz/v1",
        indexer: "https://indexer.testnet.movementnetwork.xyz/v1/graphql",
      });
      const aptos = new Aptos(config);

      const privateKey = new Ed25519PrivateKey(wallet.privateKeyHex);
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
      await aptos.waitForTransaction({
        transactionHash: result.pendingTx.hash,
      });

      showToast({
        type: 'success',
        title: 'Expense added!',
        txHash: result.pendingTx.hash,
      });

      setExpenseName('');
      setExpenseAmount('');
      setShowAddExpense(false);
      
      // Reload expenses count
      const newCount = await getGroupExpensesCount(groupId);
      setExpensesCount(newCount);
    } catch (error) {
      console.error('Add expense failed:', error);
      showToast({
        type: 'error',
        title: 'Failed to add expense',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSettleDebt = async (debt: Debt) => {
    if (!wallet?.privateKeyHex) {
      showToast({ type: 'error', title: 'Wallet not found' });
      return;
    }

    if (debt.from !== wallet.address) {
      showToast({ type: 'error', title: 'You can only settle your own debts' });
      return;
    }

    setProcessing(true);
    try {
      const payload = buildSettleDebtPayload(groupId, debt.to, debt.amount);

      const config = new AptosConfig({
        network: Network.CUSTOM,
        fullnode: "https://testnet.movementnetwork.xyz/v1",
        indexer: "https://indexer.testnet.movementnetwork.xyz/v1/graphql",
      });
      const aptos = new Aptos(config);

      const privateKey = new Ed25519PrivateKey(wallet.privateKeyHex);
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
      await aptos.waitForTransaction({
        transactionHash: result.pendingTx.hash,
      });

      showToast({
        type: 'success',
        title: 'Debt settled!',
        message: `Paid ${debt.toName}`,
        txHash: result.pendingTx.hash,
      });

      // Reload debts
      await loadDebts();
    } catch (error) {
      console.error('Settle debt failed:', error);
      showToast({
        type: 'error',
        title: 'Failed to settle debt',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setProcessing(false);
    }
  };

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
            href={`/groups/${groupId}`}
            className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Group</span>
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
                        <span className="material-symbols-outlined text-text text-2xl">receipt_long</span>
                      </div>
                      <div>
                        <h1 className="text-text text-xl lg:text-2xl font-display font-bold">{groupName}</h1>
                        <p className="text-accent text-sm font-mono">
                          Expense Tracker · {members.length} member{members.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => setShowAddExpense(!showAddExpense)}>
                      <span className="material-symbols-outlined">add</span>
                      Add Expense
                    </Button>
                  </div>
                  
                  {/* Helpful tip about group organization */}
                  {expensesCount === 0 && (
                    <div className="mt-4 p-3 border-2 border-primary bg-primary/10">
                      <p className="text-text font-mono text-xs">
                        💡 <span className="font-bold">Tip:</span> This group serves as your expense container. 
                        For different trips or events, create separate groups (e.g., "Bali Trip 2024", "NYC Weekend").
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Expense Form */}
              {showAddExpense && (
                <Card className="mb-6 border-4 border-primary">
                  <CardContent>
                    <h3 className="text-text text-lg font-display font-bold mb-4">Add New Expense</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-text text-sm font-mono font-bold mb-2 block">
                          Expense Name
                        </label>
                        <Input
                          value={expenseName}
                          onChange={(e) => setExpenseName(e.target.value)}
                          placeholder="e.g. Dinner, Uber, Hotel"
                          disabled={processing}
                        />
                      </div>
                      <div>
                        <label className="text-text text-sm font-mono font-bold mb-2 block">
                          Amount (USDC)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          placeholder="0.00"
                          disabled={processing}
                        />
                        <p className="text-accent text-xs font-mono mt-1">
                          Split equally between all {members.length} members
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddExpense}
                          disabled={processing || !expenseName || !expenseAmount}
                          className="flex-1"
                        >
                          {processing ? 'Adding...' : 'Add Expense'}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setShowAddExpense(false);
                            setExpenseName('');
                            setExpenseAmount('');
                          }}
                          disabled={processing}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`flex items-center gap-2 px-4 py-2 border-2 transition-all font-mono font-bold text-sm uppercase tracking-wider ${
                    activeTab === 'expenses'
                      ? 'bg-primary border-text text-text'
                      : 'bg-surface border-text text-text hover:bg-primary/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">receipt</span>
                  Expenses
                </button>
                <button
                  onClick={() => setActiveTab('debts')}
                  className={`flex items-center gap-2 px-4 py-2 border-2 transition-all font-mono font-bold text-sm uppercase tracking-wider ${
                    activeTab === 'debts'
                      ? 'bg-primary border-text text-text'
                      : 'bg-surface border-text text-text hover:bg-primary/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">paid</span>
                  Debts ({debts.length})
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

              {/* Expenses Tab */}
              {activeTab === 'expenses' && (
                <Card>
                  <CardContent>
                    {expensesCount === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-accent text-3xl">receipt</span>
                        </div>
                        <h3 className="text-text text-xl font-display font-bold mb-2">No Expenses Yet</h3>
                        <p className="text-accent text-sm font-mono mb-6 max-w-sm mx-auto">
                          Add your first expense to start tracking group spending!
                        </p>
                        <Button onClick={() => setShowAddExpense(true)}>
                          <span className="material-symbols-outlined">add</span>
                          Add First Expense
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 border-2 border-primary bg-primary/10">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-text font-mono font-bold text-lg">{expensesCount} Expense{expensesCount !== 1 ? 's' : ''} Recorded</p>
                              <p className="text-accent text-sm font-mono">
                                All expenses are tracked on-chain. Check the "Debts" tab to see who owes what.
                              </p>
                            </div>
                            <span className="material-symbols-outlined text-primary text-4xl">receipt_long</span>
                          </div>
                        </div>
                        <div className="p-4 border-2 border-text bg-surface">
                          <p className="text-accent text-sm font-mono mb-2">
                            💡 <span className="font-bold">How it works:</span>
                          </p>
                          <ul className="text-accent text-xs font-mono space-y-1 ml-4 list-disc">
                            <li>This group acts as a shared expense tracker for a trip/event</li>
                            <li>When you add an expense, it's split equally among all group members</li>
                            <li>The system automatically calculates who owes whom and simplifies debts</li>
                            <li>Example: Alice paid $30, Bob paid $20 for a $50 total → Alice is owed $5 from Bob</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Debts Tab */}
              {activeTab === 'debts' && (
                <Card>
                  <CardContent>
                    {processing ? (
                      <div className="text-center py-8">
                        <div className="brutalist-spinner-instant mx-auto mb-4">
                          <div className="brutalist-spinner-box-instant"></div>
                          <div className="brutalist-spinner-box-instant"></div>
                          <div className="brutalist-spinner-box-instant"></div>
                          <div className="brutalist-spinner-box-instant"></div>
                        </div>
                        <p className="text-accent font-mono text-sm">Loading debts...</p>
                      </div>
                    ) : members.length < 2 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-accent text-3xl">group_add</span>
                        </div>
                        <h3 className="text-text text-xl font-display font-bold mb-2">Need More Members</h3>
                        <p className="text-accent text-sm font-mono mb-6 max-w-sm mx-auto">
                          Debts are calculated between group members. You need at least 2 members in the group to have debts.
                        </p>
                        <p className="text-accent text-xs font-mono">
                          💡 Share the Group ID <span className="text-text font-bold">#{groupId}</span> with friends to invite them!
                        </p>
                      </div>
                    ) : debts.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-surface border-2 border-text flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                        </div>
                        <h3 className="text-text text-xl font-display font-bold mb-2">All Settled!</h3>
                        <p className="text-accent text-sm font-mono mb-4">No outstanding debts in this group</p>
                        
                        {expensesCount > 0 && members.length === 1 && (
                          <div className="max-w-md mx-auto p-4 border-2 border-primary bg-primary/10 text-left">
                            <p className="text-text font-mono text-sm mb-2">
                              💡 <span className="font-bold">Note:</span> You're the only member in this group.
                            </p>
                            <p className="text-accent font-mono text-xs">
                              Debts only appear when multiple people split expenses. Invite others to this group to start tracking shared costs!
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {debts.map((debt, idx) => {
                          const isYourDebt = wallet?.address === debt.from;
                          
                          return (
                            <div
                              key={idx}
                              className={`p-4 border-2 ${isYourDebt ? 'border-secondary bg-secondary/10' : 'border-text bg-background'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-accent text-sm">arrow_forward</span>
                                    <span className="font-mono font-bold text-text text-sm">
                                      {debt.fromName} → {debt.toName}
                                    </span>
                                    {isYourDebt && (
                                      <span className="text-[10px] bg-secondary text-white px-2 py-0.5 uppercase tracking-wider">
                                        You Owe
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-accent text-xs font-mono">
                                    ${(debt.amount / 1_000_000).toFixed(3)} USDC
                                  </p>
                                </div>
                                {isYourDebt && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSettleDebt(debt)}
                                    disabled={processing}
                                  >
                                    <span className="material-symbols-outlined">send</span>
                                    Settle
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
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

