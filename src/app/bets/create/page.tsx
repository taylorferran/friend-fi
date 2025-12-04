'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

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

  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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
    <div className="min-h-screen py-8 lg:py-12 px-4 sm:px-10 md:px-20 lg:px-40 bg-background">
      <div className="fixed inset-0 -z-10 grid-pattern" />

      <div className="max-w-3xl mx-auto relative z-10">
        <div className="flex flex-wrap justify-between gap-3 items-center mb-8">
          <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight">Create a New Bet</h1>
          <Link href="/dashboard">
            <button className="flex items-center justify-center w-10 h-10 bg-surface border-2 border-text text-text hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <p className="text-accent text-base font-mono font-bold uppercase tracking-wider">Step {step} of 2</p>
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
              <CardContent>
                <h2 className="text-text text-xl font-display font-bold mb-6">What&apos;s the prediction?</h2>
                
                <div className="mb-6">
                  <label className="text-text text-base font-mono font-bold uppercase tracking-wider block mb-2">Bet Question</label>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., Will Alice and Bob follow through with the wedding?"
                    rows={4}
                    className="w-full border-2 border-text bg-surface text-text placeholder:text-accent/60 p-4 text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    required
                  />
                </div>

                <div className="mb-6">
                  <p className="text-text text-base font-mono font-bold uppercase tracking-wider mb-3">What are the options?</p>
                  <div className="flex flex-wrap gap-3">
                    <label className={`
                      flex items-center justify-center border-2 px-6 h-12 cursor-pointer transition-all font-mono font-bold uppercase tracking-wider
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
                      flex items-center justify-center border-2 px-6 h-12 cursor-pointer transition-all font-mono font-bold uppercase tracking-wider
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

                <div className="mb-6">
                  <label className="text-text text-base font-mono font-bold uppercase tracking-wider block mb-2">Your Wager Amount</label>
                  <div className="relative max-w-xs">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-accent font-mono">USDC</span>
                    <input
                      type="number"
                      value={wagerAmount}
                      onChange={(e) => setWagerAmount(e.target.value)}
                      placeholder="25"
                      className="w-full h-12 border-2 border-text bg-surface text-text placeholder:text-accent/60 pl-16 pr-4 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <p className="text-accent text-xs mt-2 font-mono">This is your initial wager. Others can bet different amounts.</p>
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
              </CardContent>
            </Card>
          )}

          {step >= 2 && (
            <Card className="mt-6">
              <CardContent>
                <h2 className="text-text text-xl font-display font-bold mb-6">Who will settle this bet?</h2>
                
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-text text-base font-mono font-bold uppercase tracking-wider">Select Admin / Resolver</label>
                    <div className="group relative">
                      <span className="material-symbols-outlined text-accent text-base cursor-help">help</span>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-surface border-2 border-text p-2 text-center text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-mono">
                        The admin resolves the bet and declares the winning outcome.
                      </span>
                    </div>
                  </div>
                  <select
                    value={admin}
                    onChange={(e) => setAdmin(e.target.value)}
                    className="w-full h-12 border-2 border-text bg-surface text-text px-4 appearance-none font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select a friend</option>
                    {groupMembers.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                  <p className="text-accent text-xs mt-2 font-mono">The resolver will determine the final outcome and trigger payouts.</p>
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
                    <div className="flex justify-between">
                      <span className="text-accent">Your Wager</span>
                      <span className="text-text">{wagerAmount} USDC</span>
                    </div>
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
                    <Button type="submit" loading={loading} disabled={!admin}>
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
