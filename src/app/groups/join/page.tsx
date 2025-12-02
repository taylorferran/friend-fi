'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';

export default function JoinGroupPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
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
    setLoading(true);

    try {
      // TODO: Validate group ID and password against smart contract
      // TODO: Verify password can decrypt group data
      
      // Store group in session for current context
      sessionStorage.setItem('friendfi_current_group', JSON.stringify({
        id: groupId,
        name: 'Joined Group', // This would come from contract
        password: password, // Used for encryption/decryption
      }));

      // Show success and redirect
      router.push('/dashboard');
    } catch (err) {
      setError('Invalid Group ID or Password. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="fixed top-40 left-20 w-80 h-80 bg-[#7311d4]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 right-20 w-64 h-64 bg-purple-900/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 p-4 bg-[#7311d4]/20 rounded-full w-fit">
            <span className="material-symbols-outlined text-[#7311d4] text-4xl">group</span>
          </div>
          <h1 className="text-white text-3xl font-black mb-2">Join a Private Prediction Group</h1>
          <p className="text-[#ad92c9]">Enter the Group ID and password shared by the group creator.</p>
        </div>

        {/* Form */}
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                label="Group ID"
                placeholder="e.g., cosmic-crew-2024"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
                className="font-mono"
                icon={<span className="material-symbols-outlined">group</span>}
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
                  className="absolute right-4 top-[calc(50%+8px)] -translate-y-1/2 text-[#ad92c9] hover:text-white transition-colors"
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

              <p className="text-[#ad92c9] text-sm text-center">
                Or,{' '}
                <Link href="/groups/create" className="text-[#7311d4] hover:underline font-medium">
                  create a new group
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-sm">
            The group password is used to decrypt all group data. Make sure you have the correct password from your group admin.
          </p>
        </div>
      </div>
    </div>
  );
}

