'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getGroupsCount } from '@/lib/contract';

export default function JoinGroupPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const { wallet, joinGroup } = useMoveWallet();
  
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
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

    const groupIdNum = parseInt(groupId, 10);
    if (isNaN(groupIdNum) || groupIdNum < 0) {
      setError('Invalid Group ID. Please enter a valid number.');
      return;
    }

    // Check if group exists
    const groupCount = await getGroupsCount();
    if (groupIdNum >= groupCount) {
      setError(`Group ID ${groupIdNum} does not exist. There are ${groupCount} groups.`);
      return;
    }

    setLoading(true);

    try {
      const result = await joinGroup(groupIdNum, password);
      setTxHash(result.hash);
      
      // Store group info locally
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: groupIdNum,
        name: `Group #${groupIdNum}`,
        password: password,
      }));

      // Show success and redirect
      setTimeout(() => {
      router.push('/dashboard');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join group. Please check the password.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-20 pb-24 lg:pt-12 lg:pb-12 bg-background">
      <div className="fixed inset-0 -z-10 grid-pattern" />

      <div className="w-full max-w-md relative z-10">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors mb-6 font-mono uppercase text-sm tracking-wider font-bold"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Dashboard</span>
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 p-4 bg-primary border-2 border-text w-fit">
            <span className="material-symbols-outlined text-text text-4xl">group</span>
          </div>
          <h1 className="text-text text-3xl font-display font-bold mb-2">Join a Group</h1>
          <p className="text-accent font-mono">Enter the Group ID and password shared by the group creator.</p>
        </div>

        {txHash && (
          <div className="mb-6 p-4 border-2 border-green-600 bg-green-600/10">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              <div>
                <p className="text-text font-mono font-bold text-sm">Successfully joined group!</p>
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
                label="Group ID"
                placeholder="e.g., 0"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
                className="font-mono"
                icon={<span className="material-symbols-outlined">tag</span>}
                hint="The numeric ID of the group (0, 1, 2, etc.)"
              />

              <div className="relative">
                <Input
                  label="Group Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  error={error}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[calc(50%+8px)] -translate-y-1/2 text-accent hover:text-text transition-colors"
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <Button type="submit" loading={loading}>
                <span className="material-symbols-outlined">login</span>
                Join Group
              </Button>

              <p className="text-accent text-sm text-center font-mono">
                Or,{' '}
                <Link href="/groups/create" className="text-primary hover:underline font-bold">
                  create a new group
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-accent text-sm font-mono">
            The group password is used to decrypt all group data. Make sure you have the correct password from your group admin.
          </p>
        </div>
      </div>
    </div>
  );
}
