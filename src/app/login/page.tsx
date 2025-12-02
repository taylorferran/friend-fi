'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const { login, authenticated, ready, user } = usePrivy();
  const router = useRouter();
  const [showContent, setShowContent] = useState(false);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (ready && authenticated) {
      router.push('/dashboard');
    }
  }, [ready, authenticated, router]);

  // Prefetch dashboard
  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#7311d4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a2e] via-[#0d0514] to-[#050208]" />
        <div className="glow-orb w-[400px] h-[400px] bg-[#7311d4] top-0 left-1/4 opacity-30" />
        <div className="glow-orb w-[300px] h-[300px] bg-[#E42575] bottom-20 right-20 opacity-20" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-8 z-20">
        <Logo size="lg" />
      </header>

      {/* Main Content */}
      <main className={`w-full max-w-md px-6 z-10 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="glass rounded-2xl p-8 text-center">
          {/* Icon */}
          <div className="mb-6 mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7311d4]/20 to-[#E42575]/10 flex items-center justify-center border border-white/10">
            <span className="material-symbols-outlined text-[#7311d4] text-4xl">casino</span>
          </div>

          <h1 className="text-white text-3xl font-bold mb-3">
            Private Predictions
          </h1>

          <p className="text-white/60 text-base leading-relaxed mb-8">
            Sign in with email to create your Move wallet and start betting with friends.
          </p>

          {/* Login State */}
          {authenticated ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 py-4 px-4 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl">
                <span className="material-symbols-outlined text-[#10B981]">check_circle</span>
                <span className="text-[#10B981] font-medium">Connected!</span>
              </div>
              
              {user?.email && (
                <p className="text-white/70 text-sm">{user.email.address}</p>
              )}
              
              {user?.wallet && (
                <p className="text-white/40 text-xs font-mono break-all">
                  {user.wallet.address}
                </p>
              )}
              
              <Link href="/dashboard" className="block">
                <Button className="w-full animate-glow-pulse">
                  Go to Dashboard
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <Button 
                onClick={() => login()} 
                className="w-full animate-glow-pulse"
                size="lg"
              >
                <span className="material-symbols-outlined">mail</span>
                Continue with Email
              </Button>

              <div className="flex items-center gap-3 text-white/30">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs uppercase tracking-wider">Powered by</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="flex items-center justify-center gap-3 text-white/40 text-sm">
                <span className="font-medium">Privy</span>
                <span className="text-xs">×</span>
                <span className="font-medium">Movement Network</span>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="material-symbols-outlined text-[#7311d4] text-xl mb-1">lock</span>
                <p className="text-white/40 text-xs">Encrypted</p>
              </div>
              <div>
                <span className="material-symbols-outlined text-[#10B981] text-xl mb-1">local_gas_station</span>
                <p className="text-white/40 text-xs">No Gas</p>
              </div>
              <div>
                <span className="material-symbols-outlined text-[#E42575] text-xl mb-1">payments</span>
                <p className="text-white/40 text-xs">USDC</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full p-8 z-20">
        <div className="flex justify-center gap-6">
        </div>
      </footer>
    </div>
  );
}
