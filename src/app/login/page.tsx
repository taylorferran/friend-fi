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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner">
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      {/* Grid pattern */}
      <div className="fixed inset-0 -z-10 grid-pattern" />

      {/* Header */}
      <header className="border-b-2 border-text p-6">
        <Logo size="lg" />
      </header>

      {/* Main Content */}
      <main className={`flex-1 flex items-center justify-center p-6 transition-all duration-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="w-full max-w-md">
          <div className="bg-surface border-2 border-text p-8">
            {/* Icon */}
            <div className="mb-6 mx-auto w-20 h-20 bg-primary border-2 border-text flex items-center justify-center">
              <span className="material-symbols-outlined text-text text-4xl">groups</span>
            </div>

            <h1 className="text-text text-3xl font-display font-bold mb-3 text-center">
              Friend-Fi
            </h1>

            <p className="text-accent text-base font-mono leading-relaxed mb-8 text-center">
              Sign in with email to create your Move wallet and access social DeFi apps with friends.
            </p>

            {/* Login State */}
            {authenticated ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 py-4 px-4 bg-green-100 border-2 border-green-600">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                  <span className="text-green-600 font-mono font-bold uppercase tracking-wider">Connected!</span>
                </div>
                
                {user?.email && (
                  <p className="text-accent text-sm font-mono text-center">{user.email.address}</p>
                )}
                
                {user?.wallet && (
                  <p className="text-accent/60 text-xs font-mono break-all text-center">
                    {user.wallet.address}
                  </p>
                )}
                
                <Link href="/dashboard" className="block">
                  <Button className="w-full">
                    Go to Dashboard
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <Button 
                  onClick={() => login()} 
                  className="w-full"
                  size="lg"
                >
                  <span className="material-symbols-outlined">mail</span>
                  Continue with Email
                </Button>

                <div className="flex items-center gap-3 text-accent">
                  <div className="flex-1 h-0.5 bg-text/20" />
                  <span className="text-xs uppercase tracking-wider font-mono font-bold">Powered by</span>
                  <div className="flex-1 h-0.5 bg-text/20" />
                </div>

                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary border-2 border-text">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="var(--text)"/>
                      <path d="M2 17L12 22L22 17" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 12L12 17L22 12" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="font-mono font-bold text-text text-sm">Privy</span>
                  </div>
                  <span className="text-accent text-xs">×</span>
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface border-2 border-text">
                    <span className="material-symbols-outlined text-primary text-lg">bolt</span>
                    <span className="font-mono font-bold text-text text-sm">Movement</span>
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="mt-8 pt-6 border-t-2 border-text">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 border-2 border-text bg-background">
                  <span className="material-symbols-outlined text-primary text-xl mb-1">lock</span>
                  <p className="text-accent text-xs font-mono uppercase tracking-wider font-bold">Encrypted</p>
                </div>
                <div className="p-3 border-2 border-text bg-background">
                  <span className="material-symbols-outlined text-green-600 text-xl mb-1">local_gas_station</span>
                  <p className="text-accent text-xs font-mono uppercase tracking-wider font-bold">No Gas</p>
                </div>
                <div className="p-3 border-2 border-text bg-background">
                  <span className="material-symbols-outlined text-secondary text-xl mb-1">payments</span>
                  <p className="text-accent text-xs font-mono uppercase tracking-wider font-bold">USDC</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
