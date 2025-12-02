'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

const groupMembers = [
  { id: '1', name: 'David' },
  { id: '2', name: 'Sarah' },
  { id: '3', name: 'Michael' },
  { id: '4', name: 'Emma' },
];

export default function CreateBetPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  
  const [question, setQuestion] = useState('');
  const [betType, setBetType] = useState<'yesno' | 'multiple'>('yesno');
  const [wagerAmount, setWagerAmount] = useState('');
  const [admin, setAdmin] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Redirect to login if not authenticated
  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Call Move smart contract to create bet
      console.log('Creating bet:', { question, betType, wagerAmount, admin });
      
      alert('Bet created successfully!');
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to create bet:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-10 md:px-20 lg:px-40">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap justify-between gap-3 items-center mb-8">
          <h1 className="text-white text-3xl lg:text-4xl font-black tracking-tight">Create a New Bet</h1>
          <Link href="/dashboard">
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </Link>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <p className="text-white/80 text-base font-medium">Step {step} of 2</p>
          </div>
          <div className="rounded-lg bg-[#4d3267]/50 overflow-hidden">
            <div 
              className="h-2 rounded-lg bg-[#7311d4] transition-all duration-300"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: The Bet */}
          {step >= 1 && (
            <div className={step === 1 ? '' : 'opacity-60'}>
              <h2 className="text-white text-xl font-bold mb-4">What&apos;s the prediction?</h2>
              
              <div className="mb-6">
                <label className="text-white/90 text-base font-medium block mb-2">Bet Question</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Will Alice and Bob follow through with the wedding?"
                  rows={4}
                  className="w-full rounded-lg border border-[#4d3267] bg-[#261933] text-white/90 placeholder:text-[#ad92c9]/60 p-4 text-base focus:outline-none focus:ring-2 focus:ring-[#7311d4]/50 focus:border-[#7311d4] resize-none"
                  required
                />
              </div>

              <div className="mb-6">
                <p className="text-white/90 text-base font-medium mb-2">What are the options?</p>
                <div className="flex flex-wrap gap-3">
                  <label className={`
                    flex items-center justify-center rounded-lg border px-6 h-12 cursor-pointer transition-all
                    ${betType === 'yesno' 
                      ? 'border-2 border-[#7311d4] bg-[#7311d4]/20 text-white' 
                      : 'border-[#4d3267] bg-[#261933] text-white hover:border-[#7311d4]/50'
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
                    flex items-center justify-center rounded-lg border px-6 h-12 cursor-pointer transition-all
                    ${betType === 'multiple' 
                      ? 'border-2 border-[#7311d4] bg-[#7311d4]/20 text-white' 
                      : 'border-[#4d3267] bg-[#261933] text-white hover:border-[#7311d4]/50'
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

              {/* Wager Amount - moved to step 1 */}
              <div className="mb-6">
                <label className="text-white/90 text-base font-medium block mb-2">Your Wager Amount</label>
                <div className="relative max-w-xs">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-white/50">USDC</span>
                  <input
                    type="number"
                    value={wagerAmount}
                    onChange={(e) => setWagerAmount(e.target.value)}
                    placeholder="25"
                    className="w-full h-12 rounded-lg border border-[#4d3267] bg-[#261933] text-white/90 placeholder:text-[#ad92c9]/60 pl-16 pr-4 focus:outline-none focus:ring-2 focus:ring-[#7311d4]/50 focus:border-[#7311d4]"
                    required
                  />
                </div>
                <p className="text-white/40 text-xs mt-2">This is your initial wager. Others can bet different amounts.</p>
              </div>

              {step === 1 && (
                <Button 
                  type="button" 
                  onClick={() => setStep(2)}
                  disabled={!question || !wagerAmount}
                >
                  Continue
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Button>
              )}
            </div>
          )}

          {/* Step 2: The Resolver */}
          {step >= 2 && (
            <div className="mt-8">
              <h2 className="text-white text-xl font-bold mb-4">Who will settle this bet?</h2>
              
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-white/90 text-base font-medium">Select Admin / Resolver</label>
                  <div className="group relative">
                    <span className="material-symbols-outlined text-white/50 text-base cursor-help">help</span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-md bg-[#261933] border border-white/10 p-2 text-center text-xs text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      The admin resolves the bet and declares the winning outcome.
                    </span>
                  </div>
                </div>
                <select
                  value={admin}
                  onChange={(e) => setAdmin(e.target.value)}
                  className="w-full h-12 rounded-lg border border-[#4d3267] bg-[#261933] text-white/90 px-4 appearance-none focus:outline-none focus:ring-2 focus:ring-[#7311d4]/50 focus:border-[#7311d4]"
                  required
                >
                  <option value="">Select a friend</option>
                  {groupMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
                <p className="text-white/40 text-xs mt-2">The resolver will determine the final outcome and trigger payouts.</p>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                <h3 className="text-white font-medium mb-3">Bet Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Question</span>
                    <span className="text-white text-right max-w-[200px] truncate">{question}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Type</span>
                    <span className="text-white">{betType === 'yesno' ? 'Yes / No' : 'Multiple Choice'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Your Wager</span>
                    <span className="text-white">{wagerAmount} USDC</span>
                  </div>
                </div>
              </div>

              {/* Finalization */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
                <p className="text-sm text-green-400/80 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">verified</span>
                  No gas fees for you!
                </p>
                
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    Back
                  </Button>
                  <Button type="submit" loading={loading} disabled={!admin}>
                    Create Bet
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
