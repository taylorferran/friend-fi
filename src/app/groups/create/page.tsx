'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';

export default function CreateGroupPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const { wallet, balance, createGroup } = useMoveWallet();
  
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTxHash(null);

    if (!wallet) {
      setError('Wallet not initialized');
      return;
    }

    if (balance === 0) {
      setError('Your wallet has no MOVE tokens. Please fund it first via Settings.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Call the smart contract
      const result = await createGroup(groupName, password);
      setTxHash(result.hash);

      // Store group info locally for reference
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: result.groupId,
        name: groupName,
        password: password,
      }));

      // Show success and redirect
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create group. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="fixed inset-0 -z-10 grid-pattern" />

      <div className="w-full max-w-lg relative z-10">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Dashboard</span>
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 p-4 bg-primary border-2 border-text w-fit">
            <span className="material-symbols-outlined text-text text-4xl">group_add</span>
          </div>
          <h1 className="text-text text-3xl font-display font-bold mb-2">Create a New Group</h1>
          <p className="text-accent font-mono">Set up a private prediction group and invite your friends.</p>
        </div>

        {/* Wallet status banner */}
        {wallet && balance === 0 && (
          <div className="mb-6 p-4 border-2 border-secondary bg-secondary/10">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-secondary">warning</span>
              <div>
                <p className="text-text font-mono font-bold text-sm">Wallet needs funding</p>
                <p className="text-accent text-xs font-mono mt-1">
                  Your Move wallet has no MOVE tokens. Go to{' '}
                  <Link href="/settings" className="text-primary hover:underline font-bold">Settings</Link>
                  {' '}to copy your address and fund it from the faucet.
                </p>
              </div>
            </div>
          </div>
        )}

        {txHash && (
          <div className="mb-6 p-4 border-2 border-green-600 bg-green-600/10">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              <div>
                <p className="text-text font-mono font-bold text-sm">Group created on-chain!</p>
                <a 
                  href={`https://explorer.movementnetwork.xyz/txn/${txHash}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-xs font-mono hover:underline flex items-center gap-1 mt-1"
                >
                  View transaction <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                label="Group Name"
                placeholder="e.g., The Wedding Predictors"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
              />

              <div className="flex flex-col w-full">
                <label className="text-text text-base font-bold font-mono uppercase tracking-wider pb-2">
                  Description <span className="text-accent">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What's this group for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border-2 border-text bg-surface text-text placeholder:text-accent/60 p-4 text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex flex-col w-full">
                <div className="flex items-center gap-2 pb-2">
                  <label className="text-text text-base font-bold font-mono uppercase tracking-wider">Group Password</label>
                  <div className="group relative">
                    <span className="material-symbols-outlined text-accent text-base cursor-help">help</span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-surface border-2 border-text p-3 text-center text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 font-mono">
                      This password encrypts all group data on-chain. Members need it to view and participate in bets.
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Choose a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-accent hover:text-text transition-colors"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="text-accent text-xs mt-2 font-mono">Minimum 6 characters. Share securely with friends.</p>
              </div>

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                error={error}
              />

              <div className="flex items-start gap-3 p-4 bg-primary/20 border-2 border-primary">
                <span className="material-symbols-outlined text-text text-xl">lock</span>
                <div>
                  <p className="text-text text-sm font-mono font-bold uppercase tracking-wider">End-to-End Encryption</p>
                  <p className="text-accent text-xs mt-1 font-mono">
                    All group data is encrypted with your password before being stored on-chain. Even we can&apos;t see your bets!
                  </p>
                </div>
              </div>

              <Button type="submit" loading={loading} className="mt-2">
                <span className="material-symbols-outlined">add_circle</span>
                Create Group
              </Button>

              <p className="text-accent text-sm text-center font-mono">
                Want to join an existing group?{' '}
                <Link href="/groups/join" className="text-primary hover:underline font-bold">
                  Join here
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
