'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { useAuth } from '@/hooks/useAuth';

export default function CreateGroupPage() {
  const router = useRouter();
  const { authenticated, ready } = useAuth();
  const { wallet, createGroup } = useMoveWallet();
  const { showToast } = useToast();
  
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet) {
      showToast({ type: 'error', title: 'Wallet not initialized' });
      return;
    }

    if (password !== confirmPassword) {
      showToast({ type: 'error', title: 'Passwords do not match' });
      return;
    }

    if (password.length < 6) {
      showToast({ type: 'error', title: 'Password too short', message: 'Must be at least 6 characters' });
      return;
    }

    setLoading(true);

    try {
      // Call the smart contract
      const result = await createGroup(groupName, password, description);
      
      // Store group info locally for reference
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: result.groupId,
        name: groupName,
        password: password,
      }));

      showToast({
        type: 'success',
        title: 'Group created!',
        message: groupName,
        txHash: result.hash,
      });

      // Redirect after a moment
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create group';
      showToast({ type: 'error', title: 'Transaction failed', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 pt-20 pb-24 lg:pt-4 lg:pb-4 bg-background">
      <div className="fixed inset-0 -z-10 grid-pattern" />

      <div className="w-full max-w-lg relative z-10">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Back to Dashboard</span>
        </Link>

        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto mb-4 p-4 sm:p-5 bg-primary border-2 border-text w-fit">
            <span className="material-symbols-outlined text-text text-3xl sm:text-4xl">group_add</span>
          </div>
          <h1 className="text-text text-2xl sm:text-3xl font-display font-bold mb-2">Create a New Group</h1>
          <p className="text-accent font-mono text-sm sm:text-base">Set up a private prediction group and invite your friends.</p>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
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
