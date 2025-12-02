'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';

function generateGroupId() {
  const adjectives = ['cosmic', 'stellar', 'lunar', 'solar', 'astral', 'crystal', 'thunder', 'diamond', 'golden', 'silver'];
  const nouns = ['crew', 'squad', 'gang', 'pack', 'tribe', 'club', 'circle', 'league', 'alliance', 'guild'];
  const randomNum = Math.floor(Math.random() * 9999);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}-${randomNum}`;
}

export default function CreateGroupPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState(generateGroupId());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to login if not authenticated
  if (ready && !authenticated) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      // TODO: Call Move smart contract to create group
      
      // Store group in session for current context
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: groupId,
        name: groupName,
        password: password, // Used for encryption/decryption
      }));

      // Show success and redirect
      alert('Group created successfully! Share your Group ID and Password with friends.');
      router.push('/dashboard');
    } catch (err) {
      setError('Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="fixed top-40 right-20 w-80 h-80 bg-[#7311d4]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 left-20 w-64 h-64 bg-purple-900/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Back button */}
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-sm font-medium">Back to Dashboard</span>
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 p-4 bg-[#7311d4]/20 rounded-full w-fit">
            <span className="material-symbols-outlined text-[#7311d4] text-4xl">group_add</span>
          </div>
          <h1 className="text-white text-3xl font-black mb-2">Create a New Group</h1>
          <p className="text-[#ad92c9]">Set up a private prediction group and invite your friends.</p>
        </div>

        {/* Form */}
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
                <label className="text-white text-base font-medium leading-normal pb-2">
                  Description <span className="text-white/40">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What's this group for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#4d3267] bg-[#261933] text-white placeholder:text-[#ad92c9]/60 p-4 text-base focus:outline-none focus:ring-2 focus:ring-[#7311d4]/50 focus:border-[#7311d4] resize-none"
                />
              </div>

              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between pb-2">
                  <label className="text-white text-base font-medium">Group ID</label>
                  <button 
                    type="button" 
                    onClick={() => setGroupId(generateGroupId())}
                    className="text-[#7311d4] text-sm hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    Generate
                  </button>
                </div>
                <Input
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  required
                  className="font-mono"
                  icon={<span className="material-symbols-outlined">tag</span>}
                  hint="Share this ID with friends so they can join"
                />
              </div>

              <div className="flex flex-col w-full">
                <div className="flex items-center gap-2 pb-2">
                  <label className="text-white text-base font-medium">Group Password</label>
                  <div className="group relative">
                    <span className="material-symbols-outlined text-white/40 text-base cursor-help">help</span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-md bg-[#261933] border border-white/10 p-3 text-center text-xs text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#ad92c9] hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="text-white/40 text-xs mt-2">Minimum 6 characters. Share securely with friends.</p>
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

              {/* Security Notice */}
              <div className="flex items-start gap-3 p-4 bg-[#7311d4]/10 border border-[#7311d4]/30 rounded-lg">
                <span className="material-symbols-outlined text-[#7311d4] text-xl">lock</span>
                <div>
                  <p className="text-white text-sm font-medium">End-to-End Encryption</p>
                  <p className="text-white/60 text-xs mt-1">
                    All group data is encrypted with your password before being stored on-chain. Even we can&apos;t see your bets!
                  </p>
                </div>
              </div>

              <Button type="submit" loading={loading} className="mt-2">
                <span className="material-symbols-outlined">add_circle</span>
                Create Group
              </Button>

              <p className="text-[#ad92c9] text-sm text-center">
                Want to join an existing group?{' '}
                <Link href="/groups/join" className="text-[#7311d4] hover:underline font-medium">
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

