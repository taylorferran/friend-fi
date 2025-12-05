'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Logo } from '@/components/ui/Logo';
import { MobileNav } from './MobileNav';
import { useMoveWallet } from '@/hooks/useMoveWallet';
import { getUSDCBalance } from '@/lib/indexer';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
];

const bottomNavItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function getAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=F5C301,E60023,593D2C&backgroundType=gradientLinear`;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = usePrivy();
  const { wallet: moveWallet } = useMoveWallet();
  const [userSettings, setUserSettings] = useState<{ username?: string; avatarUrl?: string } | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Load USDC balance from indexer
  const loadUSDCBalance = useCallback(async () => {
    if (!moveWallet?.address) return;
    
    setLoadingBalance(true);
    try {
      const balance = await getUSDCBalance(moveWallet.address);
      setUsdcBalance(balance);
    } catch (error) {
      console.error('Error loading USDC balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  }, [moveWallet?.address]);

  // Load user settings and listen for updates
  const loadSettings = useCallback(() => {
    const saved = sessionStorage.getItem('friendfi_user_settings');
    if (saved) {
      setUserSettings(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadUSDCBalance();

    // Listen for profile updates
    const handleProfileUpdate = (e: CustomEvent) => {
      setUserSettings(e.detail);
    };

    window.addEventListener('profile-updated', handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate as EventListener);
    };
  }, [loadSettings, loadUSDCBalance]);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/groups') || pathname.startsWith('/bets');
    }
    return pathname.startsWith(href);
  };

  const displayName = userSettings?.username || user?.email?.address?.split('@')[0] || 'Anonymous';
  const avatarUrl = userSettings?.avatarUrl || getAvatarUrl('default');

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col bg-surface border-r-2 border-text h-screen sticky top-0">
        <div className="flex h-full flex-col justify-between">
          <div className="flex flex-col">
            {/* Logo */}
            <div className="px-4 py-4 border-b-2 border-text">
              <Logo size="md" />
            </div>

            {/* User Info */}
            {user && (
              <div className="border-b-2 border-text">
                <Link href="/settings" className="flex gap-3 px-4 py-4 group hover:bg-primary/20 transition-colors">
                  <img 
                    src={avatarUrl}
                    alt="Your avatar"
                    className="w-12 h-12 border-2 border-text group-hover:border-primary transition-colors"
                  />
                  <div className="flex flex-col overflow-hidden flex-1">
                    <h2 className="text-text text-sm font-bold font-mono truncate group-hover:text-accent transition-colors">
                      {displayName}
                    </h2>
                    <p className="text-accent text-xs font-mono">
                      {loadingBalance ? '...' : (usdcBalance / 1_000_000).toFixed(2)} USDC
                    </p>
                  </div>
                </Link>
              </div>
            )}

            {/* Main Navigation */}
            <nav className="flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 border-b-2 border-text transition-all font-mono uppercase text-sm tracking-wider
                    ${isActive(item.href) 
                      ? 'bg-primary text-text' 
                      : 'text-text hover:bg-primary/20'
                    }
                  `}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <p className="font-bold">{item.label}</p>
                </Link>
              ))}
            </nav>

            {/* Quick Actions */}
            <div className="px-4 py-4 border-b-2 border-text">
              <p className="text-accent text-xs font-mono font-bold uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="space-y-2">
                <Link
                  href="/groups/create"
                  className="flex items-center gap-2 px-3 py-2 bg-primary/20 border-2 border-text text-text hover:bg-primary transition-colors text-sm font-mono font-bold"
                >
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                  New Group
                </Link>
                <Link
                  href="/groups/join"
                  className="flex items-center gap-2 px-3 py-2 bg-surface border-2 border-text text-text hover:bg-primary/20 transition-colors text-sm font-mono font-bold"
                >
                  <span className="material-symbols-outlined text-lg">group_add</span>
                  Join Group
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="flex flex-col border-t-2 border-text">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 border-b-2 border-text transition-all font-mono uppercase text-sm tracking-wider
                  ${isActive(item.href) 
                    ? 'bg-primary text-text' 
                    : 'text-text hover:bg-primary/20'
                  }
                `}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <p className="font-bold">{item.label}</p>
              </Link>
            ))}
            
            {user && (
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 px-4 py-3 text-secondary hover:bg-secondary/20 transition-colors font-mono uppercase text-sm tracking-wider"
              >
                <span className="material-symbols-outlined">logout</span>
                <p className="font-bold">Sign Out</p>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b-2 border-text px-4 py-3 safe-area-pt">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          {user && (
            <Link href="/settings" className="flex items-center gap-2">
              <span className="text-accent text-xs font-mono">
                {loadingBalance ? '...' : (usdcBalance / 1_000_000).toFixed(2)} USDC
              </span>
              <img 
                src={avatarUrl}
                alt="Your avatar"
                className="w-8 h-8 border-2 border-text"
              />
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </>
  );
}
