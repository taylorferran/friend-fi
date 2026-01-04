'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { requestMembershipSignature } from '@/lib/signature-service';

export default function CreateBetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated } = useAuth();
  const { wallet, createBet } = useMoveWallet();
  const { showToast } = useToast();
  
  const [question, setQuestion] = useState('');
  const [betType, setBetType] = useState<'yesno' | 'multiple'>('yesno');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [initialOutcomeIndex, setInitialOutcomeIndex] = useState<number>(0);
  const [initialWager, setInitialWager] = useState<string>('0.05'); // Default minimum
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState<string>('');

  // Load current group from URL params or session storage
  useEffect(() => {
    // First check URL params
    const urlGroupId = searchParams.get('groupId');
    const urlGroupName = searchParams.get('groupName');
    
    if (urlGroupId) {
      const id = parseInt(urlGroupId, 10);
      if (!isNaN(id)) {
        setGroupId(id);
        setGroupName(urlGroupName || `Group ${id}`);
        return;
      }
    }
    
    // Fall back to session storage
    const stored = sessionStorage.getItem('friendfi_current_group');
    if (stored) {
      const group = JSON.parse(stored);
      setGroupId(group.id);
      setGroupName(group.name);
    }
  }, [searchParams]);

  // No redirect - allow page to load and show login prompt if needed

  const getOutcomes = (): string[] => {
    if (betType === 'yesno') {
      return ['Yes', 'No'];
    }
    return options.filter(opt => opt.trim() !== '');
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!wallet) {
      showToast({ type: 'error', title: 'Wallet not initialized' });
      setLoading(false);
      return;
    }

    if (groupId === null) {
      showToast({ type: 'error', title: 'No group selected', message: 'Please join or create a group first' });
      setLoading(false);
      return;
    }

    const outcomes = getOutcomes();
    if (outcomes.length < 2) {
      showToast({ type: 'error', title: 'Invalid options', message: 'You need at least 2 options for the bet' });
      setLoading(false);
      return;
    }
    
    const wagerAmount = parseFloat(initialWager);
    if (isNaN(wagerAmount) || wagerAmount < 0.05) {
      showToast({ type: 'error', title: 'Invalid wager', message: 'Minimum wager is 0.05 USDC' });
      setLoading(false);
      return;
    }

    try {
      // Step 1: Request membership signature
      console.log('[CreateBet] Requesting membership signature...');
      showToast({ 
        type: 'success', 
        title: 'Verifying membership...', 
        message: 'Checking group access' 
      });
      
      const proof = await requestMembershipSignature(groupId, wallet.address);
      console.log('[CreateBet] Signature received, expires at:', new Date(proof.expiresAt).toLocaleTimeString());
      
      // Step 2: Create bet with initial wager
      console.log('[CreateBet] Creating bet with initial wager...');
      const result = await createBet(
        groupId,
        question,
        outcomes,
        proof.signature,
        proof.expiresAt,
        initialOutcomeIndex,
        wagerAmount
      );
      
      showToast({
        type: 'success',
        title: 'Bet created!',
        message: `${question.substring(0, 40)}... with ${wagerAmount} USDC wager`,
        txHash: result.hash,
      });
      
      // Redirect after a moment
      setTimeout(() => {
        router.push(`/groups/${groupId}`);
      }, 1500);
    } catch (err) {
      console.error('[CreateBet] Error:', err);
      
      // Check if it's a membership error
      const message = err instanceof Error ? err.message : 'Failed to create bet';
      
      if (message.includes('Not a member') || message.includes('403')) {
        showToast({ 
          type: 'error', 
          title: 'Not a member', 
          message: 'You need to join this group first' 
        });
      } else if (message.includes('expired')) {
        showToast({ 
          type: 'error', 
          title: 'Signature expired', 
          message: 'Please try again' 
        });
      } else if (message.includes('Minimum wager')) {
        showToast({ 
          type: 'error', 
          title: 'Wager too low', 
          message: 'Minimum wager is 0.05 USDC' 
        });
      } else {
        showToast({ type: 'error', title: 'Transaction failed', message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 lg:pt-12 lg:pb-12 px-4 sm:px-6 lg:px-8 bg-background mobile-content">
      <div className="fixed inset-0 -z-10 grid-pattern" />

      <div className="max-w-3xl mx-auto relative z-10">
        <div className="flex flex-wrap justify-between gap-3 items-center mb-6 sm:mb-8">
          <h1 className="text-text text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight">Create a New Bet</h1>
          <Link href="/dashboard">
            <button className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-surface border-2 border-text text-text hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-lg sm:text-xl">close</span>
            </button>
          </Link>
        </div>

        {/* Group context */}
        {groupName ? (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-primary/20 border-2 border-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-text text-lg sm:text-xl">group</span>
            <span className="text-text font-mono text-xs sm:text-sm">Creating bet in: <strong>{groupName}</strong></span>
          </div>
        ) : (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 border-2 border-secondary bg-secondary/10">
            <div className="flex items-start gap-2 sm:gap-3">
              <span className="material-symbols-outlined text-secondary text-lg sm:text-xl flex-shrink-0">warning</span>
              <div>
                <p className="text-text font-mono font-bold text-xs sm:text-sm">No group selected</p>
                <p className="text-accent text-xs font-mono mt-1">
                  You need to be in a group to create a bet.{' '}
                  <Link href="/groups/create" className="text-primary hover:underline font-bold">Create a group</Link>
                  {' '}or{' '}
                  <Link href="/groups/join" className="text-primary hover:underline font-bold">join one</Link>.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between mb-2">
            <p className="text-accent text-sm sm:text-base font-mono font-bold uppercase tracking-wider">Step {step} of 2</p>
          </div>
          <div className="bg-surface border-2 border-text overflow-hidden">
            <div 
              className="h-3 bg-primary transition-all duration-300"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step >= 1 && (
            <Card className={step === 1 ? '' : 'opacity-60'}>
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-text text-lg sm:text-xl font-display font-bold mb-4 sm:mb-6">What&apos;s the prediction?</h2>
              
              <div className="mb-4 sm:mb-6">
                  <label className="text-text text-sm sm:text-base font-mono font-bold uppercase tracking-wider block mb-2">Bet Question</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Will Alice and Bob follow through with the wedding?"
                  rows={4}
                    className="w-full border-2 border-text bg-surface text-text placeholder:text-accent/60 p-3 sm:p-4 text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  required
                />
              </div>

              <div className="mb-4 sm:mb-6">
                  <p className="text-text text-sm sm:text-base font-mono font-bold uppercase tracking-wider mb-3">What are the options?</p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <label className={`
                      flex items-center justify-center border-2 px-4 sm:px-6 h-11 sm:h-12 cursor-pointer transition-all font-mono font-bold uppercase tracking-wider text-sm sm:text-base
                    ${betType === 'yesno' 
                        ? 'border-primary bg-primary text-text' 
                        : 'border-text bg-surface text-text hover:bg-primary/20'
                    }
                  `}>
                    <input
                      type="radio"
                      name="bet_type"
                      value="yesno"
                      checked={betType === 'yesno'}
                      onChange={() => setBetType('yesno')}
                      className="sr-only"
                    />
                    Yes / No
                  </label>
                  <label className={`
                      flex items-center justify-center border-2 px-4 sm:px-6 h-11 sm:h-12 cursor-pointer transition-all font-mono font-bold uppercase tracking-wider text-sm sm:text-base
                    ${betType === 'multiple' 
                        ? 'border-primary bg-primary text-text' 
                        : 'border-text bg-surface text-text hover:bg-primary/20'
                    }
                  `}>
                    <input
                      type="radio"
                      name="bet_type"
                      value="multiple"
                      checked={betType === 'multiple'}
                      onChange={() => setBetType('multiple')}
                      className="sr-only"
                    />
                    Multiple Choice
                  </label>
                </div>
              </div>

              {/* Multiple choice options input */}
              {betType === 'multiple' && (
                <div className="mb-6">
                  <label className="text-text text-base font-mono font-bold uppercase tracking-wider block mb-3">Enter Options</label>
                  <div className="space-y-3">
                    {options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-accent font-mono text-sm w-6">{index + 1}.</span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          className="flex-1 h-12 border-2 border-text bg-surface text-text placeholder:text-accent/60 px-4 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="w-10 h-10 flex items-center justify-center border-2 border-text bg-surface text-accent hover:bg-red-600/20 hover:text-red-600 hover:border-red-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-xl">close</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addOption}
                    className="mt-3 flex items-center gap-2 text-primary hover:text-text transition-colors font-mono text-sm font-bold"
                  >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    Add another option
                  </button>
                </div>
              )}

              {/* Initial Wager (NEW - Required) */}
              <div className="mb-6 p-4 border-2 border-primary bg-primary/10">
                <label className="text-text text-base font-mono font-bold uppercase tracking-wider block mb-2">Your Initial Wager (Required)</label>
                <p className="text-accent text-xs font-mono mb-3">
                  Show confidence in your bet! Minimum 0.05 USDC. Fee: 0.3% + 0.1% on resolution = ~0.4% total.
                </p>
                
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <label className="text-accent text-xs font-mono block mb-1">Which outcome will you bet on?</label>
                    <select
                      value={initialOutcomeIndex}
                      onChange={(e) => setInitialOutcomeIndex(parseInt(e.target.value))}
                      className="w-full h-12 border-2 border-text bg-surface text-text px-4 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {getOutcomes().map((outcome, idx) => (
                        <option key={idx} value={idx}>{outcome}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="w-32">
                    <label className="text-accent text-xs font-mono block mb-1">Amount (USDC)</label>
                    <input
                      type="number"
                      min="0.05"
                      step="0.01"
                      value={initialWager}
                      onChange={(e) => setInitialWager(e.target.value)}
                      placeholder="0.05"
                      className="w-full h-12 border-2 border-text bg-surface text-text placeholder:text-accent/60 px-4 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {step === 1 && (
                <Button 
                  type="button" 
                  onClick={() => setStep(2)}
                  disabled={!question || (betType === 'multiple' && getOutcomes().length < 2) || parseFloat(initialWager) < 0.05}
                >
                  Continue
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Button>
              )}
              </CardContent>
            </Card>
          )}

          {step >= 2 && (
            <Card className="mt-6">
              <CardContent>
                <h2 className="text-text text-xl font-display font-bold mb-6">Review & Confirm</h2>
              
              {/* Admin info */}
              <div className="mb-6 p-4 bg-primary/20 border-2 border-primary">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-text text-xl">admin_panel_settings</span>
                  <div>
                    <p className="text-text font-mono font-bold text-sm uppercase tracking-wider">You are the bet admin</p>
                    <p className="text-accent text-xs font-mono mt-1">
                      As the creator, you will be responsible for settling this bet and declaring the winning outcome.
                    </p>
                  </div>
                </div>
              </div>

                <div className="p-4 bg-background border-2 border-text mb-6">
                  <h3 className="text-text font-mono font-bold uppercase tracking-wider mb-3">Bet Summary</h3>
                  <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                      <span className="text-accent">Question</span>
                      <span className="text-text text-right max-w-[200px] truncate">{question}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-accent">Type</span>
                      <span className="text-text">{betType === 'yesno' ? 'Yes / No' : 'Multiple Choice'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                      <span className="text-accent">Options</span>
                      <div className="text-text text-right">
                        {getOutcomes().map((outcome, i) => (
                          <div key={i}>{outcome}</div>
                        ))}
                      </div>
                  </div>
                  {groupName && (
                    <div className="flex justify-between">
                        <span className="text-accent">Group</span>
                        <span className="text-text">{groupName}</span>
                    </div>
                  )}
                </div>
              </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t-2 border-text">
                  <p className="text-sm text-green-600 flex items-center gap-2 font-mono">
                  <span className="material-symbols-outlined text-base">verified</span>
                  No gas fees for you!
                </p>
                
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    Back
                  </Button>
                  <Button type="submit" loading={loading} disabled={groupId === null}>
                    Create Bet
                  </Button>
                </div>
              </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}
